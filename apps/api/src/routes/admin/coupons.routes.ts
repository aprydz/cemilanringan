import { Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { trustedOrigin } from '../../middlewares/trusted-origin.js'
import { HttpError } from '../../utils/http-error.js'
import { adminPaginationSchema, couponSchema, couponUpdateSchema } from './_schemas.js'

export const adminCouponsRouter = Router()

adminCouponsRouter.get('/coupons', async (request, response) => {
  const { page, limit } = adminPaginationSchema.parse(request.query)
  const [total, coupons] = await Promise.all([
    prisma.coupon.count(),
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Coupons retrieved successfully', data: coupons, meta: { page, limit, total } })
})

adminCouponsRouter.post('/coupons', trustedOrigin, async (request, response) => {
  const input = couponSchema.parse(request.body)
  const coupon = await prisma.coupon.create({ data: input })
  response.status(201).json({ success: true, message: 'Coupon created successfully', data: coupon })
})

adminCouponsRouter.patch('/coupons/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = couponUpdateSchema.parse(request.body)
  let coupon
  try {
    coupon = await prisma.coupon.update({ where: { id }, data: input })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Coupon not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Coupon updated successfully', data: coupon })
})

adminCouponsRouter.delete('/coupons/:id', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  try {
    await prisma.coupon.update({ where: { id }, data: { status: RecordStatus.INACTIVE } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new HttpError(404, 'Coupon not found')
    throw error
  }
  response.status(200).json({ success: true, message: 'Coupon deactivated', data: { id } })
})

