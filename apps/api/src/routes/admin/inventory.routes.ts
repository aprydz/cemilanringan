import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { trustedOrigin } from '../../middlewares/trusted-origin.js'
import { HttpError } from '../../utils/http-error.js'
import { inventoryAdjustmentSchema } from './_schemas.js'

export const adminInventoryRouter = Router()

adminInventoryRouter.post('/inventory/adjustments', trustedOrigin, async (request, response) => {
  const input = inventoryAdjustmentSchema.parse(request.body)
  if (input.quantity === 0) throw new HttpError(422, 'Quantity must be greater than zero')

  const result = await prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ id: string; stockOnHand: number; reservedStock: number }>>(Prisma.sql`
      SELECT id, stock_on_hand AS stockOnHand, reserved_stock AS reservedStock
      FROM product_variants WHERE id = ${input.variantId} FOR UPDATE
    `)
    const variant = rows[0]
    if (!variant) throw new HttpError(404, 'Product variant not found')

    const nextStock = input.type === 'IN'
      ? variant.stockOnHand + input.quantity
      : input.type === 'OUT'
        ? variant.stockOnHand - input.quantity
        : input.quantity
    if (nextStock < variant.reservedStock) {
      throw new HttpError(409, 'Stock cannot be lower than the quantity reserved for orders')
    }

    const delta = nextStock - variant.stockOnHand
    if (delta === 0) throw new HttpError(409, 'The adjustment would not change stock')

    const updated = await transaction.productVariant.update({
      where: { id: variant.id },
      data: { stockOnHand: nextStock },
      select: { id: true, sku: true, stockOnHand: true, reservedStock: true },
    })
    await transaction.inventoryLog.create({
      data: {
        productVariantId: variant.id,
        type: input.type,
        quantity: delta,
        referenceType: 'ADMIN_ADJUSTMENT',
        note: input.note,
      },
    })
    return updated
  })

  response.status(200).json({ success: true, message: 'Inventory updated', data: { ...result, availableStock: result.stockOnHand - result.reservedStock } })
})

adminInventoryRouter.get('/inventory/variants/:variantId/logs', async (request, response) => {
  const variantId = z.string().cuid().parse(request.params.variantId)
  const { page, limit } = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(30) }).strict().parse({ page: request.query.page, limit: request.query.limit })
  const where = { productVariantId: variantId }
  const [total, logs] = await Promise.all([
    prisma.inventoryLog.count({ where }),
    prisma.inventoryLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Inventory history retrieved', data: logs, meta: { page, limit, total } })
})

