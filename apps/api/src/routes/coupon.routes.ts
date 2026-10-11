import { Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { calculateCouponDiscount } from '../coupons/coupon.service.js'
import { prisma } from '../database/prisma.js'
import { optionalAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { HttpError } from '../utils/http-error.js'
import { calculateEffectivePrice, type EligiblePromotion } from '../promotions/promotion.service.js'

const couponValidateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  handler: (_request, response) => {
    response.status(429).json({ success: false, message: 'Too many coupon checks', errors: [] })
  },
})

export const couponRouter = Router()

const couponCodeSchema = z.object({ code: z.string().trim().min(3).max(80).transform((value) => value.toUpperCase()) }).strict()

couponRouter.post('/validate', couponValidateLimit, optionalAuth, trustedOrigin, async (request, response) => {
  const { code } = couponCodeSchema.parse(request.body)
  const userCart = request.authUser ? await prisma.cart.findUnique({ where: { userId: request.authUser.id } }) : null
  const sessionId = request.cookies?.piscokshop_cart
  const cart = userCart ?? (typeof sessionId === 'string' ? await prisma.cart.findUnique({ where: { sessionId } }) : null)
  if (!cart) throw new HttpError(409, 'Your cart is empty')

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      productVariant: {
        select: {
          price: true,
          status: true,
          product: {
            select: {
              status: true,
              promotionProducts: {
                where: { promotion: { is: { status: RecordStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } },
                include: { promotion: { select: { name: true, type: true, value: true } } },
              },
            },
          },
        },
      },
    },
  })
  if (items.length === 0) throw new HttpError(409, 'Your cart is empty')
  const subtotal = items.reduce((total, item) => {
    if (item.productVariant.status !== RecordStatus.ACTIVE || item.productVariant.product.status !== RecordStatus.ACTIVE) {
      throw new HttpError(409, 'A product in your cart is no longer available')
    }
    const promotions = item.productVariant.product.promotionProducts.map(({ promotion }) => promotion as EligiblePromotion)
    const effectivePrice = calculateEffectivePrice(item.productVariant.price, promotions)
    return total.add(effectivePrice.unitPrice.mul(item.quantity))
  }, new Prisma.Decimal(0))

  const coupon = await prisma.coupon.findUnique({ where: { code } })
  const now = new Date()
  if (!coupon || coupon.status !== RecordStatus.ACTIVE || now < coupon.startsAt || now >= coupon.endsAt) {
    throw new HttpError(404, 'Coupon is invalid or expired')
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new HttpError(409, 'Coupon usage limit has been reached')
  }

  const discount = calculateCouponDiscount(coupon, subtotal)
  response.status(200).json({
    success: true,
    message: 'Coupon applied successfully',
    data: {
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      subtotal: Number(subtotal),
      discount: Number(discount),
      totalAfterDiscount: Number(subtotal.sub(discount)),
    },
  })
})