import { DiscountType, RecordStatus } from '@prisma/client'
import { Router } from 'express'
import { prisma } from '../database/prisma.js'

export const promotionRouter = Router()

promotionRouter.get('/', async (_request, response) => {
  const now = new Date()
  const promotions = await prisma.promotion.findMany({
    where: {
      status: RecordStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
      promotionProducts: { some: { product: { is: { status: RecordStatus.ACTIVE } } } },
    },
    include: {
      promotionProducts: {
        where: { product: { is: { status: RecordStatus.ACTIVE } } },
        include: { product: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { endsAt: 'asc' },
  })

  response.status(200).json({
    success: true,
    message: 'Promotions retrieved successfully',
    data: promotions.map((promotion) => ({
      id: promotion.id,
      name: promotion.name,
      description: promotion.description,
      type: promotion.type,
      value: Number(promotion.value),
      endsAt: promotion.endsAt,
      products: promotion.promotionProducts.map(({ product }) => product),
      isPercentage: promotion.type === DiscountType.PERCENTAGE,
    })),
  })
})