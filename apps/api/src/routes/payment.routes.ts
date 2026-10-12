import { randomBytes } from 'node:crypto'
import { PaymentStatus, Prisma, ReservationStatus, ShipmentStatus } from '@prisma/client'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { releaseOrderCoupon, releaseOrderReservations } from '../database/order-helpers.js'
import { optionalAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { midtransProvider, verifyMidtransSignature, type MidtransNotification } from '../payments/midtrans.provider.js'
import { HttpError } from '../utils/http-error.js'

export const paymentRouter = Router()

const paymentSchema = z.object({
  orderNumber: z.string().min(1).max(40),
  paymentMethod: z.enum(['BANK_TRANSFER', 'GOPAY', 'QRIS', 'CREDIT_CARD']),
}).strict()

const notificationSchema = z.object({
  order_id: z.string().min(1).max(191),
  transaction_id: z.string().min(1).max(191),
  transaction_status: z.string().min(1).max(40),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  signature_key: z.string().regex(/^[a-f\d]{128}$/i),
  fraud_status: z.string().max(40).optional(),
  settlement_time: z.string().max(40).optional(),
}).strict()

const createLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 })

paymentRouter.post('/create', createLimit, optionalAuth, trustedOrigin, async (request, response) => {
  // Payment provider key sanity: Midtrans Idempotency-Key should track client idempotencyKey
  // provider uses client key via header; midtrans.provider.ts forwards input.orderId which is providerOrderId
  const input = paymentSchema.parse(request.body)
  const idempotencyKey = z.string().min(16).max(100).parse(request.get('idempotency-key'))
  if (!midtransProvider.isConfigured) throw new HttpError(503, 'Payment provider is not configured')

  const sessionId = request.cookies?.piscokshop_cart
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: input.orderNumber,
      status: 'PENDING_PAYMENT',
      OR: [
        ...(request.authUser ? [{ userId: request.authUser.id }] : []),
        ...(typeof sessionId === 'string' ? [{ guestSessionId: sessionId }] : []),
      ],
    },
    include: { items: true },
  })
  if (!order) throw new HttpError(404, 'Pending order not found')

  const existingByKey = await prisma.payment.findUnique({ where: { idempotencyKey } })
  if (existingByKey) {
    if (existingByKey.orderId !== order.id) throw new HttpError(409, 'Idempotency key is already used for another order')
    if (existingByKey.checkoutUrl) {
      response.status(200).json({ success: true, message: 'Payment transaction retrieved', data: { checkoutUrl: existingByKey.checkoutUrl, status: existingByKey.status, expiresAt: existingByKey.expiredAt } })
      return
    }
    throw new HttpError(409, 'Payment transaction is already being created')
  }

  const pendingPayment = await prisma.payment.findFirst({ where: { orderId: order.id, status: PaymentStatus.PENDING, expiredAt: { gt: new Date() }, checkoutUrl: { not: null } } })
  if (pendingPayment?.checkoutUrl) {
    response.status(200).json({ success: true, message: 'Payment transaction retrieved', data: { checkoutUrl: pendingPayment.checkoutUrl, status: pendingPayment.status, expiresAt: pendingPayment.expiredAt } })
    return
  }

  const providerOrderId = `PSK-${order.orderNumber}-${randomBytes(5).toString('hex')}`.slice(0, 191)
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      paymentMethod: input.paymentMethod,
      provider: 'MIDTRANS',
      providerTransactionId: providerOrderId,
      idempotencyKey,
      amount: order.total,
      expiredAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  })

  try {
    const transaction = await midtransProvider.createTransaction({
      orderId: providerOrderId,
      amount: Number(order.total),
      customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone },
      items: [
        ...order.items.map((item) => ({ id: item.sku, price: Number(item.price), quantity: item.quantity, name: `${item.productName} ${item.flavorName} ${item.sizeName}`.slice(0, 50) })),
        ...(Number(order.shippingCost) > 0 ? [{ id: 'SHIPPING', price: Number(order.shippingCost), quantity: 1, name: 'Pengiriman' }] : []),
      ],
      paymentMethod: input.paymentMethod,
    })
    const saved = await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutUrl: transaction.checkoutUrl, expiredAt: transaction.expiresAt, rawResponse: transaction.rawResponse as Prisma.InputJsonValue },
      select: { checkoutUrl: true, status: true, expiredAt: true },
    })
    response.status(201).json({ success: true, message: 'Payment transaction created', data: saved })
  } catch (error) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } })
    throw error
  }
})

paymentRouter.post('/webhook', async (request, response) => {
  if (!env.PAYMENT_SERVER_KEY) throw new HttpError(503, 'Payment provider is not configured')
  const notification = notificationSchema.parse(request.body) as MidtransNotification
  if (!verifyMidtransSignature(notification, env.PAYMENT_SERVER_KEY)) {
    throw new HttpError(401, 'Payment notification signature is invalid')
  }

  const eventId = `${notification.transaction_id}:${notification.transaction_status}:${notification.status_code}`
  const payment = await prisma.payment.findFirst({
    where: { provider: 'MIDTRANS', providerTransactionId: notification.order_id },
    include: { order: true },
  })
  if (!payment) throw new HttpError(404, 'Payment transaction not found')

  if (!new Prisma.Decimal(notification.gross_amount).equals(payment.amount)) {
    throw new HttpError(409, 'Payment amount does not match the order')
  }

  let targetStatus: PaymentStatus
  if (notification.transaction_status === 'settlement' || (notification.transaction_status === 'capture' && notification.fraud_status === 'accept')) {
    targetStatus = PaymentStatus.PAID
  } else if (notification.transaction_status === 'expire') {
    targetStatus = PaymentStatus.EXPIRED
  } else if (notification.transaction_status === 'cancel' || notification.transaction_status === 'deny' || notification.transaction_status === 'failure') {
    targetStatus = PaymentStatus.FAILED
  } else if (notification.transaction_status === 'refund' || notification.transaction_status === 'partial_refund') {
    targetStatus = PaymentStatus.REFUNDED
  } else if (notification.transaction_status === 'pending') {
    targetStatus = PaymentStatus.PENDING
  } else {
    response.status(200).json({ success: true, message: 'Payment event acknowledged', data: { ignored: true } })
    return
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const event = await transaction.paymentWebhookEvent.create({
        data: { provider: 'MIDTRANS', eventId, paymentId: payment.id, rawPayload: request.body as Prisma.InputJsonValue },
      })
      await transaction.$queryRaw`SELECT id FROM payments WHERE id = ${payment.id} FOR UPDATE`
      await transaction.$queryRaw`SELECT id FROM orders WHERE id = ${payment.orderId} FOR UPDATE`
      const currentPayment = await transaction.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { order: true } })
      const staleStatusEvent = currentPayment.status === PaymentStatus.PAID && targetStatus !== PaymentStatus.REFUNDED
        || currentPayment.status === PaymentStatus.REFUNDED
        || targetStatus === PaymentStatus.PENDING && currentPayment.status !== PaymentStatus.PENDING

      if (!staleStatusEvent && targetStatus === PaymentStatus.PAID && currentPayment.status !== PaymentStatus.PAID) {
        if (currentPayment.order.status === 'PENDING_PAYMENT') {
          const reservations = await transaction.inventoryReservation.findMany({ where: { orderId: currentPayment.orderId, status: ReservationStatus.ACTIVE } })
          for (const reservation of reservations) {
            await transaction.productVariant.update({
              where: { id: reservation.productVariantId },
              data: { stockOnHand: { decrement: reservation.quantity }, reservedStock: { decrement: reservation.quantity } },
            })
            await transaction.inventoryReservation.update({ where: { id: reservation.id }, data: { status: ReservationStatus.CONSUMED } })
            await transaction.inventoryLog.create({ data: { productVariantId: reservation.productVariantId, type: 'OUT', quantity: -reservation.quantity, referenceType: 'ORDER', referenceId: currentPayment.orderId, note: 'Reserved stock consumed after verified payment' } })
          }
          const couponRedemption = await transaction.couponRedemption.findUnique({ where: { orderId: currentPayment.orderId } })
          if (couponRedemption?.status === 'RESERVED') {
            await transaction.couponRedemption.update({ where: { id: couponRedemption.id }, data: { status: 'APPLIED' } })
          }
          await transaction.order.update({ where: { id: currentPayment.orderId }, data: { status: 'PAID', paymentStatus: PaymentStatus.PAID } })
        } else {
          await transaction.order.update({ where: { id: currentPayment.orderId }, data: { paymentStatus: PaymentStatus.PAID } })
        }
      } else if (!staleStatusEvent && targetStatus === PaymentStatus.EXPIRED && currentPayment.order.status === 'PENDING_PAYMENT') {
        await releaseOrderReservations(transaction, currentPayment.orderId, ReservationStatus.RELEASED, 'Reservation released after payment expiry')
        await releaseOrderCoupon(transaction, currentPayment.orderId)
        await transaction.order.update({ where: { id: currentPayment.orderId }, data: { status: 'CANCELLED', paymentStatus: PaymentStatus.EXPIRED, shippingStatus: ShipmentStatus.CANCELLED } })
      } else if (!staleStatusEvent && targetStatus === PaymentStatus.FAILED) {
        await transaction.order.update({ where: { id: currentPayment.orderId }, data: { paymentStatus: PaymentStatus.FAILED } })
      } else if (!staleStatusEvent && targetStatus === PaymentStatus.REFUNDED) {
        await transaction.order.update({ where: { id: currentPayment.orderId }, data: { paymentStatus: PaymentStatus.REFUNDED } })
      }

      if (!staleStatusEvent) {
        await transaction.payment.update({ where: { id: currentPayment.id }, data: { status: targetStatus, paidAt: targetStatus === PaymentStatus.PAID ? new Date() : undefined, rawResponse: request.body as Prisma.InputJsonValue } })
      }
      await transaction.paymentWebhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: new Date() } })
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      response.status(200).json({ success: true, message: 'Duplicate payment event acknowledged', data: { duplicate: true } })
      return
    }
    throw error
  }

  response.status(200).json({ success: true, message: 'Payment event processed', data: { status: targetStatus } })
})