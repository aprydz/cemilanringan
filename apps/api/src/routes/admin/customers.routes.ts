import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'

export const adminCustomersRouter = Router()

adminCustomersRouter.get('/customers', async (request, response) => {
  const { page, limit } = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(30) }).parse({ page: request.query.page, limit: request.query.limit })
  const query = z.string().trim().max(100).optional().parse(request.query.q)
  const where = { role: 'CUSTOMER' as const, ...(query ? { OR: [{ name: { contains: query } }, { email: { contains: query } }] } : {}) }
  const [total, customers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Customers retrieved successfully', data: customers, meta: { page, limit, total } })
})

