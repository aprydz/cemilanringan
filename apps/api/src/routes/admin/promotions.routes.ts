import { Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { trustedOrigin } from '../../middlewares/trusted-origin.js'
import { HttpError } from '../../utils/http-error.js'
import { adminPaginationSchema, promotionSchema, promotionUpdateSchema } from './_schemas.js'

export const adminPromotionsRouter = Router()

adminPromotionsRouter.get('/promotions', async (request, response) => {
  const { page, limit } = adminPaginationSchema.parse(request.query)
  const [total, promotions] = await Promise.all([
    prisma.promotion.count(),
    prisma.promotion.findMany({ include: { promotionProducts: { include: { product: { select: { id: true, name: true, slug: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Promotions retrieved successfully', data: promotions, meta: { page, limit, total } })
})

adminPromotionsRouter.post('/promotions', trustedOrigin, async (request, response) => {
  const { productIds, ...input } = promotionSchema.parse(request.body)
  const uniqueProductIds = [...new Set(productIds)]
  if (uniqueProductIds.length > 0) {
    const count = await prisma.product.count({ where: { id: { in: uniqueProductIds }, status: RecordStatus.ACTIVE } })
    if (count !== uniqueProductIds.length) throw new HttpError(422, 'One or more products are unavailable')
  }
  const promotion = await prisma.promotion.create({
    data: { ...input, promotionProducts: { create: uniqueProductIds.map((productId) => ({ productId })) } },
    include: { promotionProducts: true },
  })
  response.status(201).json({ success: true, message: 'Promotion created successfully', data: promotion })
})

adminPromotionsRouter.patch('/promotions/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = promotionUpdateSchema.parse(request.body)
  const { productIds, ...fields } = input
  const promotion = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.promotion.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Promotion not found')
    if (productIds !== undefined) {
      const uniqueProductIds = [...new Set(productIds)]
      const count = await transaction.product.count({ where: { id: { in: uniqueProductIds }, status: RecordStatus.ACTIVE } })
      if (count !== uniqueProductIds.length) throw new HttpError(422, 'One or more products are unavailable')
      await transaction.promotionProduct.deleteMany({ where: { promotionId: id } })
      if (uniqueProductIds.length > 0) {
        await transaction.promotionProduct.createMany({ data: uniqueProductIds.map((productId) => ({ promotionId: id, productId })) })
      }
    }
    return transaction.promotion.update({ where: { id }, data: fields, include: { promotionProducts: true } })
  })
  response.status(200).json({ success: true, message: 'Promotion updated successfully', data: promotion })
})

adminPromotionsRouter.delete('/promotions/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  try {
    await prisma.promotion.update({ where: { id }, data: { status: RecordStatus.INACTIVE } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Promotion not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Promotion deactivated', data: { id } })
})

