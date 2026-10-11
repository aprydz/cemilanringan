import { Prisma, ReservationStatus } from '@prisma/client'

type ReservationTransaction = Parameters<Parameters<typeof import('./prisma.js').prisma.$transaction>[0]>[0]

/**
 * Release all ACTIVE inventory reservations for an order.
 * Decrements reservedStock, marks reservations as the given target status,
 * and writes RELEASE inventory logs.
 */
export async function releaseOrderReservations(
  transaction: ReservationTransaction,
  orderId: string,
  targetStatus: typeof ReservationStatus.RELEASED | typeof ReservationStatus.EXPIRED,
  note: string,
) {
  const reservations = await transaction.inventoryReservation.findMany({
    where: { orderId, status: ReservationStatus.ACTIVE },
  })

  for (const reservation of reservations) {
    await transaction.productVariant.update({
      where: { id: reservation.productVariantId },
      data: { reservedStock: { decrement: reservation.quantity } },
    })
    await transaction.inventoryReservation.update({
      where: { id: reservation.id },
      data: { status: targetStatus },
    })
    await transaction.inventoryLog.create({
      data: {
        productVariantId: reservation.productVariantId,
        type: 'RELEASE',
        quantity: -reservation.quantity,
        referenceType: 'ORDER',
        referenceId: orderId,
        note,
      },
    })
  }

  return reservations.length
}

/**
 * Release a RESERVED coupon redemption for an order.
 * Decrements the coupon's usedCount and marks the redemption as RELEASED.
 */
export async function releaseOrderCoupon(
  transaction: ReservationTransaction,
  orderId: string,
) {
  const redemption = await transaction.couponRedemption.findUnique({
    where: { orderId },
  })

  if (redemption?.status === 'RESERVED') {
    await transaction.coupon.update({
      where: { id: redemption.couponId },
      data: { usedCount: { decrement: 1 } },
    })
    await transaction.couponRedemption.update({
      where: { id: redemption.id },
      data: { status: 'RELEASED' },
    })
    return true
  }

  return false
}
