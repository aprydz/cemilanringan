import { DiscountType, Prisma } from '@prisma/client'

export type EligiblePromotion = {
  name: string
  type: DiscountType
  value: Prisma.Decimal
}

export type EffectivePrice = {
  listPrice: Prisma.Decimal
  unitPrice: Prisma.Decimal
  promotionDiscount: Prisma.Decimal
  promotionName: string | null
}

export function calculateEffectivePrice(listPrice: Prisma.Decimal, promotions: EligiblePromotion[]): EffectivePrice {
  let bestDiscount = new Prisma.Decimal(0)
  let promotionName: string | null = null

  for (const promotion of promotions) {
    const candidate = promotion.type === DiscountType.PERCENTAGE
      ? listPrice.mul(promotion.value).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
      : promotion.value.toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
    const bounded = candidate.greaterThan(listPrice) ? listPrice : candidate
    if (bounded.greaterThan(bestDiscount)) {
      bestDiscount = bounded
      promotionName = promotion.name
    }
  }

  return {
    listPrice,
    unitPrice: listPrice.sub(bestDiscount),
    promotionDiscount: bestDiscount,
    promotionName,
  }
}