import { DiscountType, Prisma } from '@prisma/client'
import { HttpError } from '../utils/http-error.js'

export function calculateCouponDiscount(
  coupon: { type: DiscountType; value: Prisma.Decimal; minimumPurchase: Prisma.Decimal; maximumDiscount: Prisma.Decimal | null },
  subtotal: Prisma.Decimal,
) {
  if (subtotal.lessThan(coupon.minimumPurchase)) {
    throw new HttpError(422, 'Order subtotal does not meet this coupon minimum')
  }

  let discount = coupon.type === DiscountType.PERCENTAGE
    ? subtotal.mul(coupon.value).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
    : coupon.value.toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)

  if (coupon.maximumDiscount && discount.greaterThan(coupon.maximumDiscount)) {
    discount = coupon.maximumDiscount.toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
  }
  if (discount.greaterThan(subtotal)) discount = subtotal
  return discount
}