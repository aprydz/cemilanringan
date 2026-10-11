import { Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { trustedOrigin } from '../../middlewares/trusted-origin.js'
import { HttpError } from '../../utils/http-error.js'
import { adminPaginationSchema, productCreateSchema, productUpdateSchema, variantCreateSchema, variantUpdateSchema } from './_schemas.js'

export const adminProductsRouter = Router()

adminProductsRouter.get('/products', async (request, response) => {
  const { page, limit } = adminPaginationSchema.parse(request.query)
  const where = {}
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { include: { flavor: { select: { id: true, name: true } }, size: { select: { id: true, name: true, weightGrams: true } } }, orderBy: { sku: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  response.status(200).json({ success: true, message: 'Admin products retrieved successfully', data: products.map((product) => ({ ...product, variants: product.variants.map((variant) => ({ ...variant, price: Number(variant.price), availableStock: variant.stockOnHand - variant.reservedStock })) })), meta: { page, limit, total } })
})

adminProductsRouter.post('/products', trustedOrigin, async (request, response) => {
  const input = productCreateSchema.parse(request.body)
  const product = await prisma.$transaction(async (transaction) => {
    const category = await transaction.category.findFirst({ where: { id: input.categoryId, status: RecordStatus.ACTIVE } })
    if (!category) throw new HttpError(404, 'Active category not found')
    const created = await transaction.product.create({
      data: { name: input.name, slug: input.slug, categoryId: input.categoryId, description: input.description, status: RecordStatus.ACTIVE },
    })
    if (input.images.length > 0) {
      await transaction.productImage.createMany({ data: input.images.map((image, sortOrder) => ({ productId: created.id, url: image.url, altText: image.altText, sortOrder })) })
    }
    for (const variantInput of input.variants) {
      const { initialStock, ...variant } = variantInput
      const createdVariant = await transaction.productVariant.create({
        data: { ...variant, productId: created.id, price: new Prisma.Decimal(variant.price), stockOnHand: initialStock, status: RecordStatus.ACTIVE },
      })
      if (initialStock > 0) {
        await transaction.inventoryLog.create({
          data: { productVariantId: createdVariant.id, type: 'IN', quantity: initialStock, referenceType: 'ADMIN_PRODUCT_CREATE', referenceId: created.id, note: 'Initial stock on product creation' },
        })
      }
    }
    return transaction.product.findUniqueOrThrow({ where: { id: created.id }, include: { category: true, images: true, variants: true } })
  })
  response.status(201).json({ success: true, message: 'Product created successfully', data: product })
})

adminProductsRouter.patch('/products/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = productUpdateSchema.parse(request.body)
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Product not found')
  if (input.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, status: RecordStatus.ACTIVE } })
    if (!category) throw new HttpError(404, 'Active category not found')
  }

  const { images, ...productData } = input

  const product = await prisma.$transaction(async (transaction) => {
    if (images !== undefined) {
      await transaction.productImage.deleteMany({ where: { productId: id } })
      if (images.length > 0) {
        await transaction.productImage.createMany({
          data: images.map((image, sortOrder) => ({
            productId: id,
            url: image.url,
            altText: image.altText,
            sortOrder,
          })),
        })
      }
    }

    if (productData.status === RecordStatus.ACTIVE) {
      await transaction.productVariant.updateMany({
        where: { productId: id },
        data: { status: RecordStatus.ACTIVE },
      })
    }

    return transaction.product.update({
      where: { id },
      data: productData,
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          include: {
            flavor: { select: { id: true, name: true } },
            size: { select: { id: true, name: true, weightGrams: true } },
          },
          orderBy: { sku: 'asc' },
        },
      },
    })
  })

  response.status(200).json({ success: true, message: 'Product updated successfully', data: product })
})

adminProductsRouter.delete('/products/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new HttpError(404, 'Product not found')
  await prisma.$transaction([
    prisma.product.update({ where: { id }, data: { status: RecordStatus.INACTIVE } }),
    prisma.productVariant.updateMany({ where: { productId: id }, data: { status: RecordStatus.INACTIVE } }),
  ])
  response.status(200).json({ success: true, message: 'Product deactivated', data: { id } })
})

adminProductsRouter.post('/products/:id/variants', trustedOrigin, async (request, response) => {
  const productId = z.string().cuid().parse(request.params.id)
  const input = variantCreateSchema.parse(request.body)
  const product = await prisma.product.findFirst({ where: { id: productId, status: RecordStatus.ACTIVE } })
  if (!product) throw new HttpError(404, 'Active product not found')
  const { initialStock, ...variant } = input
  const created = await prisma.$transaction(async (transaction) => {
    const result = await transaction.productVariant.create({ data: { ...variant, productId, price: new Prisma.Decimal(variant.price), stockOnHand: initialStock, status: RecordStatus.ACTIVE } })
    if (initialStock > 0) await transaction.inventoryLog.create({ data: { productVariantId: result.id, type: 'IN', quantity: initialStock, referenceType: 'ADMIN_VARIANT_CREATE', referenceId: productId, note: 'Initial stock on variant creation' } })
    return result
  })
  response.status(201).json({ success: true, message: 'Product variant created successfully', data: { ...created, price: Number(created.price) } })
})

adminProductsRouter.patch('/variants/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = variantUpdateSchema.parse(request.body)
  const existing = await prisma.productVariant.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Product variant not found')
  const updated = await prisma.productVariant.update({ where: { id }, data: { ...input, price: input.price === undefined ? undefined : new Prisma.Decimal(input.price) } })
  response.status(200).json({ success: true, message: 'Product variant updated successfully', data: { ...updated, price: Number(updated.price) } })
})

adminProductsRouter.delete('/variants/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const variant = await prisma.productVariant.findUnique({ where: { id } })
  if (!variant) throw new HttpError(404, 'Product variant not found')
  if (variant.reservedStock > 0) throw new HttpError(409, 'A variant with reserved stock cannot be deactivated')
  await prisma.productVariant.update({ where: { id }, data: { status: RecordStatus.INACTIVE } })
  response.status(200).json({ success: true, message: 'Product variant deactivated', data: { id } })
})

