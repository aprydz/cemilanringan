import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../database/prisma.js'
import { optionalAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { HttpError } from '../utils/http-error.js'
import { shippingProvider } from '../shipping/shipping.provider.js'

export const shippingRouter = Router()

const quoteSchema = z.object({
  postalCode: z.string().trim().min(3).max(20),
}).strict()

shippingRouter.post('/quotes', optionalAuth, trustedOrigin, async (request, response) => {
  const { postalCode } = quoteSchema.parse(request.body)
  const userCart = request.authUser
    ? await prisma.cart.findUnique({ where: { userId: request.authUser.id } })
    : null
  const sessionId = request.cookies?.piscokshop_cart
  const cart = userCart ?? (typeof sessionId === 'string'
    ? await prisma.cart.findUnique({ where: { sessionId } })
    : null)
  if (!cart) throw new HttpError(409, 'Your cart is empty')

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: { productVariant: { select: { weightGrams: true } } },
  })
  if (items.length === 0) throw new HttpError(409, 'Your cart is empty')

  const totalWeightGrams = items.reduce((total, item) => total + item.productVariant.weightGrams * item.quantity, 0)
  const quote = await shippingProvider.quote({ postalCode, totalWeightGrams })
  response.status(200).json({ success: true, message: 'Shipping quote retrieved successfully', data: quote })
})