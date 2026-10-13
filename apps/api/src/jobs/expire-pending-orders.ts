import { OrderStatus, PaymentStatus, ReservationStatus, ShipmentStatus } from '@prisma/client'
import { prisma } from '../database/prisma.js'
import { releaseOrderCoupon, releaseOrderReservations } from '../database/order-helpers.js'
import { logger } from '../utils/logger.js'

export async function expirePendingOrders(now = new Date()) {
  const expiredReservations = await prisma.inventoryReservation.findMany({
    where: { status: ReservationStatus.ACTIVE, expiresAt: { lte: now }, order: { is: { status: OrderStatus.PENDING_PAYMENT } } },
    select: { orderId: true },
    distinct: ['orderId'],
    take: 100,
  })

  let expiredCount = 0
  for (const { orderId } of expiredReservations) {
    const didExpire = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`
      const order = await transaction.order.findUnique({ where: { id: orderId } })
      if (!order || order.status !== OrderStatus.PENDING_PAYMENT) return false

      await releaseOrderReservations(transaction, orderId, ReservationStatus.EXPIRED, 'Reservation released after checkout expiry')
      await releaseOrderCoupon(transaction, orderId)

      await transaction.payment.updateMany({
        where: { orderId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.EXPIRED },
      })
      await transaction.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.EXPIRED, shippingStatus: ShipmentStatus.CANCELLED },
      })
      return true
    })
    if (didExpire) expiredCount += 1
  }

  return expiredCount
}

export async function startReservationExpiryWorker() {
  let consecutiveFailures = 0

  const formatError = (error: unknown) => {
    if (error instanceof Error) {
      const withCode = error as Error & { code?: unknown }
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(withCode.code !== undefined ? { code: withCode.code } : {}),
      }
    }
    return { value: String(error) }
  }

  const run = async () => {
    try {
      const count = await expirePendingOrders()
      consecutiveFailures = 0
      if (count > 0) logger.info(`Expired ${count} pending Piscokshop order(s)`)
    } catch (error) {
      consecutiveFailures += 1
      const detail = formatError(error)
      logger.error('Pending order expiry job failed', {
        error: detail,
        consecutiveFailures,
        hint: consecutiveFailures >= 3
          ? 'expiry job keeps failing (≥3x). Check DATABASE_URL connectivity and Prisma migration status'
          : undefined,
      })
      if (consecutiveFailures >= 10) {
        logger.error(
          'Pending order expiry job is repeatedly failing — suppressing further error spam for now (job keeps retrying every 60s)',
          { consecutiveFailures },
        )
      }
    }
  }

  await run()
  const interval = setInterval(() => void run(), 60_000)
  // Hindari interval tetap hidup saat process mau shutdown / testing
  if (typeof interval.unref === 'function') interval.unref()
  return () => clearInterval(interval)
}