import { Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { trustedOrigin } from '../../middlewares/trusted-origin.js'
import { HttpError } from '../../utils/http-error.js'
import { adminPaginationSchema, categorySchema, sizeSchema, taxonomySchema } from './_schemas.js'

export const adminTaxonomyRouter = Router()

adminTaxonomyRouter.get('/categories', async (request, response) => {
  const { page, limit } = adminPaginationSchema.parse(request.query)
  const [total, categories] = await Promise.all([
    prisma.category.count(),
    prisma.category.findMany({ orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Admin categories retrieved successfully', data: categories, meta: { page, limit, total } })
})

adminTaxonomyRouter.post('/categories', trustedOrigin, async (request, response) => {
  const input = categorySchema.parse(request.body)
  const category = await prisma.category.create({ data: input })
  response.status(201).json({ success: true, message: 'Category created successfully', data: category })
})

adminTaxonomyRouter.patch('/categories/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = categorySchema.partial().strict().parse(request.body)
  let category
  try {
    category = await prisma.category.update({ where: { id }, data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Category not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Category updated successfully', data: category })
})

adminTaxonomyRouter.delete('/categories/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  try {
    const productCount = await prisma.product.count({ where: { categoryId: id } })
    if (productCount === 0) {
      await prisma.category.delete({ where: { id } })
      return response.status(200).json({ success: true, message: 'Category deleted permanently', data: { id } })
    }
    await prisma.category.update({ where: { id }, data: { status: RecordStatus.INACTIVE } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Category not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Category deactivated', data: { id } })
})

adminTaxonomyRouter.get('/flavors', async (request, response) => {
  const { page, limit } = adminPaginationSchema.parse(request.query)
  const [total, flavors] = await Promise.all([
    prisma.flavor.count(),
    prisma.flavor.findMany({ orderBy: { name: 'asc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Admin flavors retrieved successfully', data: flavors, meta: { page, limit, total } })
})

adminTaxonomyRouter.get('/sizes', async (request, response) => {
  const { page, limit } = adminPaginationSchema.parse(request.query)
  const [total, sizes] = await Promise.all([
    prisma.size.count(),
    prisma.size.findMany({ orderBy: { weightGrams: 'asc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Admin sizes retrieved successfully', data: sizes, meta: { page, limit, total } })
})

adminTaxonomyRouter.post('/flavors', trustedOrigin, async (request, response) => {
  const input = taxonomySchema.parse(request.body)
  const flavor = await prisma.flavor.create({ data: input })
  response.status(201).json({ success: true, message: 'Flavor created successfully', data: flavor })
})

adminTaxonomyRouter.patch('/flavors/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = taxonomySchema.partial().strict().parse(request.body)
  let flavor
  try {
    flavor = await prisma.flavor.update({ where: { id }, data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Flavor not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Flavor updated successfully', data: flavor })
})

adminTaxonomyRouter.delete('/flavors/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  try {
    const variantCount = await prisma.productVariant.count({ where: { flavorId: id } })
    if (variantCount === 0) {
      await prisma.flavor.delete({ where: { id } })
      return response.status(200).json({ success: true, message: 'Flavor deleted permanently', data: { id } })
    }
    await prisma.flavor.update({ where: { id }, data: { status: RecordStatus.INACTIVE } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Flavor not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Flavor deactivated', data: { id } })
})

adminTaxonomyRouter.post('/sizes', trustedOrigin, async (request, response) => {
  const input = sizeSchema.parse(request.body)
  const size = await prisma.size.create({ data: input })
  response.status(201).json({ success: true, message: 'Size created successfully', data: size })
})

adminTaxonomyRouter.patch('/sizes/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = sizeSchema.partial().strict().parse(request.body)
  let size
  try {
    size = await prisma.size.update({ where: { id }, data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Size not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Size updated successfully', data: size })
})

adminTaxonomyRouter.delete('/sizes/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  try {
    const variantCount = await prisma.productVariant.count({ where: { sizeId: id } })
    if (variantCount === 0) {
      await prisma.size.delete({ where: { id } })
      return response.status(200).json({ success: true, message: 'Size deleted permanently', data: { id } })
    }
    await prisma.size.update({ where: { id }, data: { status: RecordStatus.INACTIVE } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Size not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Size deactivated', data: { id } })
})

