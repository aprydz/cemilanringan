import { randomBytes } from 'node:crypto'
import { Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { optionalAuth, requireAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { HttpError } from '../utils/http-error.js'
import { shippingProvider } from '../shipping/shipping.provider.js'
import { calculateCouponDiscount } from '../coupons/coupon.service.js'
import { calculateEffectivePrice, type EligiblePromotion } from '../promotions/promotion.service.js'

const orderCreateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  handler: (_request, response) => {
    response.status(429).json({ success: false, message: 'Too many order attempts, please try again later', errors: [] })
  },
})

export const orderRouter = Router()

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(191).transform((email) => email.toLowerCase()),
  customerPhone: z.string().trim().min(8).max(30),
  address: z.object({
    label: z.string().trim().max(60).optional(),
    recipientName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(8).max(30),
    province: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    district: z.string().trim().min(1).max(100),
    village: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().min(3).max(20),
    address: z.string().trim().min(8).max(2000),
  }).strict(),
  saveAddress: z.boolean().optional(),
  addressLabel: z.string().trim().max(60).optional(),
  isDefaultAddress: z.boolean().optional(),
  couponCode: z.string().trim().min(3).max(80).transform((value) => value.toUpperCase()).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict()

const orderListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
}).strict()

const makeOrderNumber = () => `PSK-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`

const findCheckoutCart = async (request: import('express').Request) => {
  if (request.authUser) {
    const userCart = await prisma.cart.findUnique({ where: { userId: request.authUser.id } })
    if (userCart) return userCart
  }

  const sessionId = request.cookies?.piscokshop_cart
  if (typeof sessionId === 'string') {
    return prisma.cart.findUnique({ where: { sessionId } })
  }

  return null
}

orderRouter.post('/', orderCreateLimit, optionalAuth, trustedOrigin, async (request, response) => {
  const input = checkoutSchema.parse(request.body)
  const cart = await findCheckoutCart(request)
  if (!cart) throw new HttpError(409, 'Your cart is empty')

  const order = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM carts WHERE id = ${cart.id} FOR UPDATE`
    const cartItems = await transaction.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        productVariant: {
          include: {
            product: { select: { name: true, status: true } },
            flavor: { select: { name: true, status: true } },
            size: { select: { name: true, status: true } },
          },
        },
      },
      orderBy: { productVariantId: 'asc' },
    })
    if (cartItems.length === 0) throw new HttpError(409, 'Your cart is empty')
    const productIds = [...new Set(cartItems.map(({ productVariant }) => productVariant.productId))]
    const promotionRows = await transaction.promotionProduct.findMany({
      where: {
        productId: { in: productIds },
        promotion: { is: { status: RecordStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } },
      },
      include: { promotion: { select: { name: true, type: true, value: true } } },
    })
    const promotionsByProduct = new Map<string, EligiblePromotion[]>()
    for (const row of promotionRows) {
      const current = promotionsByProduct.get(row.productId) ?? []
      current.push(row.promotion)
      promotionsByProduct.set(row.productId, current)
    }
    const totalWeightGrams = cartItems.reduce((total, item) => total + item.productVariant.weightGrams * item.quantity, 0)
    const quote = await shippingProvider.quote({ postalCode: input.address.postalCode, totalWeightGrams })
    const shippingCost = new Prisma.Decimal(quote.cost)

    const lockedVariants = new Map<string, { price: Prisma.Decimal; stockOnHand: number; reservedStock: number; status: string }>()
    for (const variantId of [...new Set(cartItems.map(({ productVariantId }) => productVariantId))].sort()) {
      const rows = await transaction.$queryRaw<Array<{
        id: string
        price: Prisma.Decimal
        stockOnHand: number
        reservedStock: number
        status: string
      }>>(Prisma.sql`
        SELECT id, price, stock_on_hand AS stockOnHand, reserved_stock AS reservedStock, status
        FROM product_variants
        WHERE id = ${variantId}
        FOR UPDATE
      `)
      if (rows[0]) lockedVariants.set(variantId, rows[0])
    }

    const orderItems: Array<{
      productVariantId: string
      productName: string
      flavorName: string
      sizeName: string
      sku: string
      listPrice: Prisma.Decimal
      price: Prisma.Decimal
      promotionDiscount: Prisma.Decimal
      promotionName: string | null
      quantity: number
      subtotal: Prisma.Decimal
    }> = []
    let subtotal = new Prisma.Decimal(0)

    for (const item of cartItems) {
      const variant = item.productVariant
      const locked = lockedVariants.get(variant.id)
      if (!locked || locked.status !== RecordStatus.ACTIVE || variant.product.status !== RecordStatus.ACTIVE || variant.flavor.status !== RecordStatus.ACTIVE || variant.size.status !== RecordStatus.ACTIVE) {
        throw new HttpError(409, 'A product in your cart is no longer available')
      }

      if (locked.stockOnHand - locked.reservedStock < item.quantity) {
        throw new HttpError(409, `Not enough stock for ${variant.sku}`)
      }

      const effectivePrice = calculateEffectivePrice(locked.price, promotionsByProduct.get(variant.productId) ?? [])
      const linePrice = effectivePrice.unitPrice
      const lineSubtotal = linePrice.mul(item.quantity)
      subtotal = subtotal.add(lineSubtotal)
      orderItems.push({
        productVariantId: variant.id,
        productName: variant.product.name,
        flavorName: variant.flavor.name,
        sizeName: variant.size.name,
        sku: variant.sku,
        listPrice: effectivePrice.listPrice,
        price: linePrice,
        promotionDiscount: effectivePrice.promotionDiscount,
        promotionName: effectivePrice.promotionName,
        quantity: item.quantity,
        subtotal: lineSubtotal,
      })

      await transaction.productVariant.update({
        where: { id: variant.id },
        data: { reservedStock: { increment: item.quantity } },
      })
    }

    let coupon: Awaited<ReturnType<typeof transaction.coupon.findUnique>> = null
    let discount = new Prisma.Decimal(0)
    if (input.couponCode) {
      await transaction.$queryRaw`SELECT id FROM coupons WHERE code = ${input.couponCode} FOR UPDATE`
      coupon = await transaction.coupon.findUnique({ where: { code: input.couponCode } })
      const now = new Date()
      if (!coupon || coupon.status !== RecordStatus.ACTIVE || now < coupon.startsAt || now >= coupon.endsAt) {
        throw new HttpError(409, 'Coupon is invalid or expired')
      }
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new HttpError(409, 'Coupon usage limit has been reached')
      }
      discount = calculateCouponDiscount(coupon, subtotal)
      await transaction.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
    }

    const orderId = makeOrderNumber()
    const addressSnapshot = {
      label: input.address.label ?? 'Alamat pengiriman',
      recipientName: input.address.recipientName,
      phone: input.address.phone,
      province: input.address.province,
      city: input.address.city,
      district: input.address.district,
      village: input.address.village ?? null,
      postalCode: input.address.postalCode,
      address: input.address.address,
    }
    const total = subtotal.sub(discount).add(shippingCost)

    const createdOrder = await transaction.order.create({
      data: {
        orderNumber: orderId,
        userId: request.authUser?.id ?? null,
        guestSessionId: request.authUser ? null : cart.sessionId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        shippingAddressSnapshot: addressSnapshot as Prisma.InputJsonValue,
        subtotal,
        discount,
        shippingCost,
        total,
        couponId: coupon?.id,
        couponCodeSnapshot: coupon?.code,
        notes: input.notes,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        shippingStatus: 'PENDING',
      },
    })

    if (coupon) {
      await transaction.couponRedemption.create({
        data: { couponId: coupon.id, userId: request.authUser?.id ?? null, orderId: createdOrder.id, discount, status: 'RESERVED' },
      })
    }

    for (const item of orderItems) {
      await transaction.orderItem.create({ data: { orderId: createdOrder.id, ...item } })
      await transaction.inventoryReservation.create({
        data: {
          orderId: createdOrder.id,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      })
      await transaction.inventoryLog.create({
        data: {
          productVariantId: item.productVariantId,
          type: 'RESERVE',
          quantity: item.quantity,
          referenceType: 'ORDER',
          referenceId: createdOrder.id,
          note: 'Stock reserved for checkout',
        },
      })
    }

    if (request.authUser && input.saveAddress) {
      const userId = request.authUser.id
      const existingAddresses = await transaction.address.findMany({
        where: { userId },
      })
      const isDuplicate = existingAddresses.some(
        (addr) =>
          addr.postalCode === input.address.postalCode &&
          addr.address.trim().toLowerCase() === input.address.address.trim().toLowerCase() &&
          addr.city.trim().toLowerCase() === input.address.city.trim().toLowerCase()
      )
      if (!isDuplicate) {
        const isDefault = Boolean(input.isDefaultAddress) || existingAddresses.length === 0
        if (isDefault && existingAddresses.length > 0) {
          await transaction.address.updateMany({
            where: { userId },
            data: { isDefault: false },
          })
        }
        await transaction.address.create({
          data: {
            userId,
            label: input.addressLabel || input.address.label || (existingAddresses.length === 0 ? 'Utama' : 'Alamat Pengiriman'),
            recipientName: input.address.recipientName,
            phone: input.address.phone,
            province: input.address.province,
            city: input.address.city,
            district: input.address.district,
            village: input.address.village ?? null,
            postalCode: input.address.postalCode,
            address: input.address.address,
            isDefault,
          },
        })
      }
    }

    await transaction.cartItem.deleteMany({ where: { cartId: cart.id } })
    // #9: remove empty guest carts to avoid orphaned rows; user carts are kept for reuse
    if (!cart.userId) {
      await transaction.cart.delete({ where: { id: cart.id } }).catch(() => {})
    }
    return createdOrder
  })

  response.status(201).json({
    success: true,
    message: 'Order created; payment is pending',
    data: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      address: order.shippingAddressSnapshot,
    },
  })
})

orderRouter.get('/', requireAuth, async (request, response) => {
  const query = orderListSchema.parse(request.query)
  const where = { userId: request.authUser!.id }
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        shippingStatus: true,
        total: true,
        createdAt: true,
        items: { select: { productName: true, flavorName: true, sizeName: true, sku: true, price: true, quantity: true, subtotal: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ])

  response.status(200).json({
    success: true,
    message: 'Orders retrieved successfully',
    data: orders.map((order) => ({
      ...order,
      total: Number(order.total),
      items: order.items.map((item) => ({ ...item, price: Number(item.price), subtotal: Number(item.subtotal) })),
    })),
    meta: { page: query.page, limit: query.limit, total },
  })
})

orderRouter.get('/:orderNumber', optionalAuth, async (request, response) => {
  const orderNumber = z.string().min(1).max(40).parse(request.params.orderNumber)
  const sessionId = request.cookies?.piscokshop_cart
  const owners = [
    ...(request.authUser ? [{ userId: request.authUser.id }] : []),
    ...(typeof sessionId === 'string' ? [{ guestSessionId: sessionId }] : []),
  ]
  if (owners.length === 0) throw new HttpError(404, 'Order not found')
  const order = await prisma.order.findFirst({
    where: { orderNumber, OR: owners },
    include: {
      items: true,
      payments: { select: { paymentMethod: true, provider: true, amount: true, status: true, paidAt: true, expiredAt: true } },
      shipments: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')

  response.status(200).json({
    success: true,
    message: 'Order retrieved successfully',
    data: {
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingCost: Number(order.shippingCost),
      total: Number(order.total),
      items: order.items.map((item) => ({ ...item, price: Number(item.price), subtotal: Number(item.subtotal) })),
      payments: order.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
    },
  })
})