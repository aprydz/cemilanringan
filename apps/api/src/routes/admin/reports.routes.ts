import { OrderStatus, PaymentStatus, Prisma, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../database/prisma.js'
import { HttpError } from '../../utils/http-error.js'

export const adminReportsRouter = Router()

adminReportsRouter.get('/reports/sales', async (request, response) => {
  const query = z.object({ from: z.coerce.date(), to: z.coerce.date() }).strict().parse(request.query)
  if (query.from > query.to) throw new HttpError(422, 'Report start date must be before end date')
  const days = Math.ceil((query.to.getTime() - query.from.getTime()) / (24 * 60 * 60 * 1000)) + 1
  if (days > 366) throw new HttpError(422, 'Report range must be at most 366 days')
  const toExclusive = new Date(query.to)
  toExclusive.setDate(toExclusive.getDate() + 1)
  const rows = await prisma.$queryRaw<Array<{ day: string; totalSales: Prisma.Decimal; orderCount: number }>>(Prisma.sql`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, SUM(total) AS totalSales, COUNT(*) AS orderCount
    FROM orders
    WHERE payment_status = 'PAID' AND created_at >= ${query.from} AND created_at < ${toExclusive}
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `)
  response.status(200).json({ success: true, message: 'Sales report retrieved successfully', data: rows.map((row) => ({ day: row.day, totalSales: Number(row.totalSales), orderCount: Number(row.orderCount) })) })
})

adminReportsRouter.get('/dashboard', async (_request, response) => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [sales, todaySales, totalOrders, pendingOrders, productsSold, lowStock, recentOrders] = await Promise.all([
    prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.PAID }, _sum: { total: true } }),
    prisma.payment.aggregate({ where: { status: PaymentStatus.PAID, paidAt: { gte: startOfDay } }, _sum: { amount: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING_PAYMENT } }),
    prisma.orderItem.aggregate({ where: { order: { is: { paymentStatus: PaymentStatus.PAID } } }, _sum: { quantity: true } }),
    prisma.productVariant.findMany({
      where: { status: RecordStatus.ACTIVE, stockOnHand: { lte: 5 } },
      select: { id: true, sku: true, stockOnHand: true, reservedStock: true, product: { select: { name: true } } },
      orderBy: { stockOnHand: 'asc' },
      take: 10,
    }),
    prisma.order.findMany({
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, paymentStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  response.status(200).json({
    success: true,
    message: 'Admin dashboard retrieved successfully',
    data: {
      totalSales: Number(sales._sum.total ?? 0),
      todaySales: Number(todaySales._sum?.amount ?? 0),
      totalOrders,
      pendingOrders,
      productsSold: productsSold._sum.quantity ?? 0,
      lowStock: lowStock.map((variant) => ({ ...variant, availableStock: variant.stockOnHand - variant.reservedStock })),
      recentOrders: recentOrders.map((order) => ({ ...order, total: Number(order.total) })),
    },
  })
})

