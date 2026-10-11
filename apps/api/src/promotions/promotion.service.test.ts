import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DiscountType, Prisma } from '@prisma/client'
import { calculateCouponDiscount } from '../coupons/coupon.service.js'
import { calculateEffectivePrice } from './promotion.service.js'

test('applies the best promotion without stacking discounts', () => {
  const price = calculateEffectivePrice(new Prisma.Decimal(10000), [
    { name: 'Ten percent', type: DiscountType.PERCENTAGE, value: new Prisma.Decimal(10) },
    { name: 'Flat 1500', type: DiscountType.FIXED, value: new Prisma.Decimal(1500) },
  ])

  assert.equal(price.listPrice.toString(), '10000')
  assert.equal(price.unitPrice.toString(), '8500')
  assert.equal(price.promotionDiscount.toString(), '1500')
  assert.equal(price.promotionName, 'Flat 1500')
})

test('rounds percentage promotions down to whole rupiah and never creates a negative price', () => {
  const percentage = calculateEffectivePrice(new Prisma.Decimal(10999), [
    { name: 'Ten percent', type: DiscountType.PERCENTAGE, value: new Prisma.Decimal(10) },
  ])
  const oversizedFixed = calculateEffectivePrice(new Prisma.Decimal(1000), [
    { name: 'Clearance', type: DiscountType.FIXED, value: new Prisma.Decimal(5000) },
  ])

  assert.equal(percentage.unitPrice.toString(), '9900')
  assert.equal(percentage.promotionDiscount.toString(), '1099')
  assert.equal(oversizedFixed.unitPrice.toString(), '0')
})

test('coupon discount is calculated after the effective promotion price', () => {
  const promotionPrice = calculateEffectivePrice(new Prisma.Decimal(10000), [
    { name: 'Ten percent', type: DiscountType.PERCENTAGE, value: new Prisma.Decimal(10) },
  ])
  const couponDiscount = calculateCouponDiscount({
    type: DiscountType.PERCENTAGE,
    value: new Prisma.Decimal(10),
    minimumPurchase: new Prisma.Decimal(0),
    maximumDiscount: null,
  }, promotionPrice.unitPrice)

  assert.equal(promotionPrice.unitPrice.toString(), '9000')
  assert.equal(couponDiscount.toString(), '900')
  assert.equal(promotionPrice.unitPrice.sub(couponDiscount).toString(), '8100')
})