import { randomBytes } from 'node:crypto'
import { RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { optionalAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { HttpError } from '../utils/http-error.js'
import { calculateEffectivePrice, type EligiblePromotion } from '../promotions/promotion.service.js'

export const cartRouter = Router()

const guestCookieName = 'piscokshop_cart'
const guestCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api',
  maxAge: 180 * 24 * 60 * 60 * 1000,
}

const addItemSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.coerce.number().int().positive().max(50),
}).strict()
const quantitySchema = z.object({ quantity: z.coerce.number().int().positive().max(50) }).strict()

const getOrCreateUserCart = async (userId: string, guestSessionId?: string) => {
  const guestCart = guestSessionId
    ? await prisma.cart.findUnique({ where: { sessionId: guestSessionId }, include: { items: true } })
    : null
  const userCart = await prisma.cart.findUnique({ where: { userId } })

  if (!userCart && guestCart) {
    return prisma.cart.update({ where: { id: guestCart.id }, data: { userId, sessionId: null } })
  }

  const targetCart = userCart ?? await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } })
  if (guestCart && guestCart.id !== targetCart.id) {
    await prisma.$transaction(async (transaction) => {
      for (const item of guestCart.items) {
        const variant = await transaction.productVariant.findUnique({
          where: { id: item.productVariantId },
          select: { status: true, stockOnHand: true, reservedStock: true },
        })
        const available = variant?.status === RecordStatus.ACTIVE
          ? Math.max(0, variant.stockOnHand - variant.reservedStock)
          : 0
        if (available === 0) continue

        const where = { cartId_productVariantId: { cartId: targetCart.id, productVariantId: item.productVariantId } }
        const existing = await transaction.cartItem.findUnique({ where })
        const quantity = Math.min(available, item.quantity + (existing?.quantity ?? 0))
        await transaction.cartItem.upsert({
          where,
          update: { quantity },
          create: { cartId: targetCart.id, productVariantId: item.productVariantId, quantity },
        })
      }
      await transaction.cart.delete({ where: { id: guestCart.id } })
    })
  }

  return targetCart
}

const resolveCart = async (request: import('express').Request, response: import('express').Response) => {
  if (request.authUser) {
    const cart = await getOrCreateUserCart(request.authUser.id, request.cookies?.[guestCookieName])
    response.clearCookie(guestCookieName, guestCookieOptions)
    return cart
  }

  let sessionId = request.cookies?.[guestCookieName]
  if (typeof sessionId !== 'string' || sessionId.length < 32) {
    sessionId = randomBytes(32).toString('base64url')
    response.cookie(guestCookieName, sessionId, guestCookieOptions)
  }

  return prisma.cart.upsert({ where: { sessionId }, update: {}, create: { sessionId } })
}

const getCartResponse = async (cartId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                  promotionProducts: {
                    where: { promotion: { is: { status: RecordStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } },
                    include: { promotion: { select: { name: true, type: true, value: true } } },
                  },
                },
              },
              flavor: { select: { name: true, slug: true, status: true } },
              size: { select: { name: true, slug: true, weightGrams: true, unit: true, status: true } },
            },
          },
        },
      },
    },
  })

  if (!cart) throw new HttpError(404, 'Cart not found')

  const items = cart.items.map((item) => {
    const variant = item.productVariant
    const availableStock = Math.max(0, variant.stockOnHand - variant.reservedStock)
    const isAvailable = variant.status === RecordStatus.ACTIVE
      && variant.product.status === RecordStatus.ACTIVE
      && variant.flavor.status === RecordStatus.ACTIVE
      && variant.size.status === RecordStatus.ACTIVE
    const effectivePrice = calculateEffectivePrice(variant.price, variant.product.promotionProducts.map(({ promotion }) => promotion as EligiblePromotion))
    const unitPrice = Number(effectivePrice.unitPrice)
    return {
      id: item.id,
      variantId: variant.id,
      product: {
        id: variant.product.id,
        name: variant.product.name,
        slug: variant.product.slug,
        image: variant.image ?? variant.product.images[0]?.url ?? null,
      },
      flavor: variant.flavor,
      size: variant.size,
      sku: variant.sku,
      listPrice: Number(effectivePrice.listPrice),
      promotionDiscount: Number(effectivePrice.promotionDiscount),
      promotionName: effectivePrice.promotionName,
      unitPrice,
      quantity: item.quantity,
      subtotal: unitPrice * item.quantity,
      availableStock,
      isAvailable,
      isQuantityValid: isAvailable && item.quantity <= availableStock,
    }
  })

  return {
    items,
    subtotal: items.reduce((total, item) => total + item.subtotal, 0),
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
  }
}

cartRouter.use(optionalAuth)

cartRouter.get('/', async (request, response) => {
  const cart = await resolveCart(request, response)
  response.status(200).json({ success: true, message: 'Cart retrieved successfully', data: await getCartResponse(cart.id) })
})

cartRouter.post('/items', trustedOrigin, async (request, response) => {
  const input = addItemSchema.parse(request.body)
  const cart = await resolveCart(request, response)

  await prisma.$transaction(async (transaction) => {
    const variant = await transaction.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true, status: true, product: { select: { status: true } }, stockOnHand: true, reservedStock: true },
    })
    if (!variant || variant.status !== RecordStatus.ACTIVE || variant.product.status !== RecordStatus.ACTIVE) {
      throw new HttpError(404, 'Product variant not found')
    }

    const where = { cartId_productVariantId: { cartId: cart.id, productVariantId: variant.id } }
    const existing = await transaction.cartItem.findUnique({ where })
    const quantity = input.quantity + (existing?.quantity ?? 0)
    const available = variant.stockOnHand - variant.reservedStock
    if (quantity > available) throw new HttpError(409, 'Requested quantity exceeds available stock')

    await transaction.cartItem.upsert({
      where,
      update: { quantity },
      create: { cartId: cart.id, productVariantId: variant.id, quantity },
    })
  })

  response.status(200).json({ success: true, message: 'Item added to cart', data: await getCartResponse(cart.id) })
})

cartRouter.patch('/items/:id', trustedOrigin, async (request, response) => {
  const itemId = z.string().cuid().parse(request.params.id)
  const { quantity } = quantitySchema.parse(request.body)
  const cart = await resolveCart(request, response)
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { productVariant: { select: { status: true, product: { select: { status: true } }, stockOnHand: true, reservedStock: true } } },
  })

  if (!item) throw new HttpError(404, 'Cart item not found')
  const available = item.productVariant.stockOnHand - item.productVariant.reservedStock
  if (item.productVariant.status !== RecordStatus.ACTIVE || item.productVariant.product.status !== RecordStatus.ACTIVE) {
    throw new HttpError(409, 'This product variant is no longer available')
  }
  if (quantity > available) throw new HttpError(409, 'Requested quantity exceeds available stock')

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } })
  response.status(200).json({ success: true, message: 'Cart item updated', data: await getCartResponse(cart.id) })
})

cartRouter.delete('/items/:id', trustedOrigin, async (request, response) => {
  const itemId = z.string().cuid().parse(request.params.id)
  const cart = await resolveCart(request, response)
  const result = await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } })
  if (result.count === 0) throw new HttpError(404, 'Cart item not found')
  response.status(200).json({ success: true, message: 'Cart item removed', data: await getCartResponse(cart.id) })
})

cartRouter.delete('/', trustedOrigin, async (request, response) => {
  const cart = await resolveCart(request, response)
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
  response.status(200).json({ success: true, message: 'Cart cleared', data: await getCartResponse(cart.id) })
})
