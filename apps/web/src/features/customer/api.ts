import { api } from '../../lib/api'
import type { ApiResponse } from '../products/types'

export type CustomerAddress = {
  id: string
  label: string
  recipientName: string
  phone: string
  province: string
  city: string
  district: string
  village: string | null
  postalCode: string
  address: string
  isDefault: boolean
}

export type CustomerOrder = {
  orderNumber: string
  status: string
  paymentStatus: string
  shippingStatus: string
  total: number
  createdAt: string
  items: Array<{ productName: string; flavorName: string; sizeName: string; sku: string; listPrice: number; price: number; promotionDiscount: number; promotionName: string | null; quantity: number; subtotal: number }>
}

export type CustomerOrderDetail = CustomerOrder & {
  shippingAddressSnapshot: Record<string, string | null>
  subtotal: number
  discount: number
  shippingCost: number
  notes: string | null
  payments: Array<{ paymentMethod: string; provider: string; amount: number; status: string; paidAt: string | null; expiredAt: string | null }>
  shipments: Array<{ courier: string; service: string; trackingNumber: string | null; status: string; shippedAt: string | null; deliveredAt: string | null; events: Array<{ status: string; description: string | null; occurredAt: string }> }>
}

export async function getAddresses(signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CustomerAddress[]>>('/addresses', { signal })
  return response.data.data
}

export async function createAddress(input: Omit<CustomerAddress, 'id' | 'village'> & { village?: string }) {
  const response = await api.post<ApiResponse<CustomerAddress>>('/addresses', input)
  return response.data.data
}

export async function updateAddress(id: string, input: Partial<Pick<CustomerAddress, 'isDefault'>>) {
  const response = await api.patch<ApiResponse<CustomerAddress>>(`/addresses/${encodeURIComponent(id)}`, input)
  return response.data.data
}

export async function deleteAddress(id: string) {
  await api.delete(`/addresses/${encodeURIComponent(id)}`)
}

export async function getCustomerOrders(page = 1, limit = 20, signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CustomerOrder[]>>('/orders', { params: { page, limit }, signal })
  return response.data
}

export async function getCustomerOrder(orderNumber: string, signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CustomerOrderDetail>>(`/orders/${encodeURIComponent(orderNumber)}`, { signal })
  return response.data.data
}