import { api } from '../../lib/api'
import type { ApiResponse } from '../products/types'

export type ShippingQuote = {
  code: string
  courier: string
  service: string
  cost: number
  estimatedDays: { minimum: number; maximum: number }
  totalWeightGrams: number
}

export type CheckoutInput = {
  customerName: string
  customerEmail: string
  customerPhone: string
  address: {
    label?: string
    recipientName: string
    phone: string
    province: string
    city: string
    district: string
    village?: string
    postalCode: string
    address: string
  }
  notes?: string
  couponCode?: string
}

export type CreatedOrder = {
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: number
  discount: number
  shippingCost: number
  total: number
}

export async function getShippingQuote(postalCode: string) {
  const response = await api.post<ApiResponse<ShippingQuote>>('/shipping/quotes', { postalCode })
  return response.data.data
}

export async function createOrder(input: CheckoutInput) {
  const response = await api.post<ApiResponse<CreatedOrder>>('/orders', input)
  return response.data.data
}

export type PaymentMethod = 'BANK_TRANSFER' | 'GOPAY' | 'QRIS' | 'CREDIT_CARD'
export type PaymentCreation = { checkoutUrl: string; status: string; expiresAt: string | null }
export type CouponValidation = { code: string; type: string; value: number; subtotal: number; discount: number; totalAfterDiscount: number }

export async function createPayment(orderNumber: string, paymentMethod: PaymentMethod, idempotencyKey: string) {
  const response = await api.post<ApiResponse<PaymentCreation>>('/payments/create', { orderNumber, paymentMethod }, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return response.data.data
}

export async function validateCoupon(code: string) {
  const response = await api.post<ApiResponse<CouponValidation>>('/coupons/validate', { code })
  return response.data.data
}