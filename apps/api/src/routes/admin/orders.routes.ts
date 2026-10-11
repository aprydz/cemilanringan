import { OrderStatus, PaymentStatus, Prisma, ShipmentStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { releaseOrderCoupon, releaseOrderReservations } from '../../database/order-helpers.js'
import { trustedOrigin } from '../../middlewares/trusted-origin.js'
import { HttpError } from '../../utils/http-error.js'
import { allowedTransitions, orderStatusSchema, shippingUpdateSchema } from './_schemas.js'

export const adminOrdersRouter = Router()

adminOrdersRouter.get('/orders', async (request, response) => {
  const { page, limit } = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(30) }).parse({ page: request.query.page, limit: request.query.limit })
  const status = request.query.status ? z.nativeEnum(OrderStatus).parse(request.query.status) : undefined
  const where = status ? { status } : {}
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, select: { id: true, orderNumber: true, customerName: true, customerEmail: true, total: true, status: true, paymentStatus: true, shippingStatus: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ])
  response.status(200).json({ success: true, message: 'Orders retrieved successfully', data: orders.map((order) => ({ ...order, total: Number(order.total) })), meta: { page, limit, total } })
})

adminOrdersRouter.get('/orders/:id', async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, payments: true, shipments: { include: { events: { orderBy: { occurredAt: 'desc' } } } } } })
  if (!order) throw new HttpError(404, 'Order not found')
  response.status(200).json({ success: true, message: 'Order retrieved successfully', data: order })
})

adminOrdersRouter.patch('/orders/:id/status', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const { status } = orderStatusSchema.parse(request.body)

  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`
    const order = await transaction.order.findUnique({ where: { id } })
    if (!order) throw new HttpError(404, 'Order not found')
    if (!allowedTransitions[order.status].includes(status)) {
      throw new HttpError(409, `Order cannot move from ${order.status} to ${status}`)
    }

    if (status === OrderStatus.CANCELLED) {
      await releaseOrderReservations(transaction, order.id, 'RELEASED', 'Reservation released after order cancellation')
      await releaseOrderCoupon(transaction, order.id)
      await transaction.order.update({ where: { id }, data: { status, paymentStatus: PaymentStatus.EXPIRED, shippingStatus: ShipmentStatus.CANCELLED } })
      return transaction.order.findUniqueOrThrow({ where: { id } })
    }

    if (status === OrderStatus.SHIPPED) {
      const shipment = await transaction.shipment.findFirst({ where: { orderId: id, trackingNumber: { not: null } } })
      if (!shipment) throw new HttpError(409, 'Add a tracking number before marking the order shipped')
      await transaction.shipment.update({ where: { id: shipment.id }, data: { status: ShipmentStatus.SHIPPED, shippedAt: new Date() } })
      await transaction.shipmentEvent.create({ data: { shipmentId: shipment.id, status: ShipmentStatus.SHIPPED, description: 'Order handed to courier', occurredAt: new Date() } })
      await transaction.order.update({ where: { id }, data: { status, shippingStatus: ShipmentStatus.SHIPPED } })
      return transaction.order.findUniqueOrThrow({ where: { id } })
    }

    if (status === OrderStatus.DELIVERED) {
      const shipment = await transaction.shipment.findFirst({ where: { orderId: id, status: ShipmentStatus.SHIPPED } })
      if (!shipment) throw new HttpError(409, 'Order has no active shipment')
      await transaction.shipment.update({ where: { id: shipment.id }, data: { status: ShipmentStatus.DELIVERED, deliveredAt: new Date() } })
      await transaction.shipmentEvent.create({ data: { shipmentId: shipment.id, status: ShipmentStatus.DELIVERED, description: 'Delivery confirmed by admin', occurredAt: new Date() } })
      await transaction.order.update({ where: { id }, data: { status, shippingStatus: ShipmentStatus.DELIVERED } })
      return transaction.order.findUniqueOrThrow({ where: { id } })
    }

    return transaction.order.update({ where: { id }, data: { status } })
  })

  response.status(200).json({ success: true, message: 'Order status updated', data: updated })
})

adminOrdersRouter.patch('/orders/:id/shipping', trustedOrigin, async (request, response) => {
  const id = z.string().cuid().parse(request.params.id)
  const input = shippingUpdateSchema.parse(request.body)
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!order) throw new HttpError(404, 'Order not found')
  if (!['PROCESSING', 'PACKING'].includes(order.status)) throw new HttpError(409, 'Shipping details can only be set while processing or packing')

  const shipmentStatus = input.trackingNumber ? ShipmentStatus.LABEL_CREATED : ShipmentStatus.PENDING
  const shipment = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.shipment.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } })
    const saved = existing
      ? await transaction.shipment.update({ where: { id: existing.id }, data: { courier: input.courier, service: input.service, trackingNumber: input.trackingNumber, shippingCost: input.shippingCost, status: shipmentStatus } })
      : await transaction.shipment.create({ data: { orderId: id, courier: input.courier, service: input.service, trackingNumber: input.trackingNumber, shippingCost: input.shippingCost, status: shipmentStatus } })
    await transaction.order.update({ where: { id }, data: { shippingStatus: shipmentStatus } })
    await transaction.shipmentEvent.create({ data: { shipmentId: saved.id, status: shipmentStatus, description: 'Shipping details updated by admin', occurredAt: new Date() } })
    return saved
  })

  response.status(200).json({ success: true, message: 'Shipping information updated', data: shipment })
})

