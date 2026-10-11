import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../database/prisma.js'
import { requireAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { HttpError } from '../utils/http-error.js'

export const addressRouter = Router()

const addressFields = {
  label: z.string().trim().min(1).max(60),
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  province: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  village: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(3).max(20),
  address: z.string().trim().min(8).max(2000),
  isDefault: z.boolean().default(false),
}
const createSchema = z.object(addressFields).strict()
const updateSchema = z.object({ ...addressFields, isDefault: z.boolean().optional() }).partial().strict()

addressRouter.use(requireAuth)

addressRouter.get('/', async (request, response) => {
  const addresses = await prisma.address.findMany({
    where: { userId: request.authUser!.id },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
  response.status(200).json({ success: true, message: 'Addresses retrieved successfully', data: addresses })
})

addressRouter.post('/', trustedOrigin, async (request, response) => {
  const input = createSchema.parse(request.body)
  const userId = request.authUser!.id
  const address = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
    const count = await transaction.address.count({ where: { userId } })
    const shouldDefault = input.isDefault || count === 0
    if (shouldDefault) await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return transaction.address.create({ data: { ...input, isDefault: shouldDefault, userId } })
  })

  response.status(201).json({ success: true, message: 'Address created successfully', data: address })
})

addressRouter.patch('/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = updateSchema.parse(request.body)
  const userId = request.authUser!.id
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) throw new HttpError(404, 'Address not found')

  const address = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
    if (input.isDefault) await transaction.address.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } })
    if (input.isDefault === false && existing.isDefault) {
      const replacement = await transaction.address.findFirst({ where: { userId, id: { not: id } }, orderBy: { updatedAt: 'desc' } })
      if (!replacement) throw new HttpError(409, 'The only saved address must remain the default address')
      await transaction.address.update({ where: { id: replacement.id }, data: { isDefault: true } })
    }
    return transaction.address.update({ where: { id }, data: input })
  })
  response.status(200).json({ success: true, message: 'Address updated successfully', data: address })
})

addressRouter.delete('/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const userId = request.authUser!.id
  const existing = await prisma.address.findFirst({ where: { id, userId } })
  if (!existing) throw new HttpError(404, 'Address not found')

  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
    const current = await transaction.address.findFirst({ where: { id, userId } })
    if (!current) throw new HttpError(404, 'Address not found')
    await transaction.address.delete({ where: { id } })
    if (current.isDefault) {
      const nextDefault = await transaction.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } })
      if (nextDefault) await transaction.address.update({ where: { id: nextDefault.id }, data: { isDefault: true } })
    }
  })
  response.status(200).json({ success: true, message: 'Address deleted successfully', data: null })
})
