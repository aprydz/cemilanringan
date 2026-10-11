import { api } from '../../lib/api'
import type { ApiResponse } from '../products/types'

export type AdminDashboardData = {
  totalSales: number
  todaySales: number
  totalOrders: number
  pendingOrders: number
  productsSold: number
  lowStock: Array<{ id: string; sku: string; stockOnHand: number; reservedStock: number; availableStock: number; product: { name: string } }>
  recentOrders: Array<{ id: string; orderNumber: string; customerName: string; total: number; status: string; paymentStatus: string; createdAt: string }>
}

export type AdminOrder = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  total: number
  status: string
  paymentStatus: string
  shippingStatus: string
  createdAt: string
}

export async function getDashboard() {
  const response = await api.get<ApiResponse<AdminDashboardData>>('/admin/dashboard')
  return response.data.data
}

export async function getAdminOrders(status?: string) {
  const response = await api.get<ApiResponse<AdminOrder[]>>('/admin/orders', { params: status ? { status } : {} })
  return response.data.data
}

export async function updateOrderStatus(id: string, status: string) {
  const response = await api.patch<ApiResponse<AdminOrder>>(`/admin/orders/${encodeURIComponent(id)}/status`, { status })
  return response.data.data
}

export async function adjustInventory(input: { variantId: string; type: 'IN' | 'OUT' | 'ADJUSTMENT'; quantity: number; note?: string }) {
  const response = await api.post<ApiResponse<{ id: string; sku: string; stockOnHand: number; reservedStock: number; availableStock: number }>>('/admin/inventory/adjustments', input)
  return response.data.data
}

export type AdminOrderDetail = AdminOrder & {
  shippingAddressSnapshot: Record<string, string | null>
  notes: string | null
  items: Array<{ id: string; productName: string; flavorName: string; sizeName: string; sku: string; price: number; quantity: number; subtotal: number }>
  payments: Array<{ id: string; provider: string; paymentMethod: string; status: string; amount: number; paidAt: string | null }>
  shipments: Array<{ id: string; courier: string; service: string; trackingNumber: string | null; status: string }>
}

export async function getAdminOrder(id: string) {
  const response = await api.get<ApiResponse<AdminOrderDetail>>(`/admin/orders/${encodeURIComponent(id)}`)
  return response.data.data
}

export async function updateOrderShipping(id: string, input: { courier: string; service: string; trackingNumber?: string; shippingCost: number }) {
  const response = await api.patch<ApiResponse<AdminOrderDetail['shipments'][number]>>(`/admin/orders/${encodeURIComponent(id)}/shipping`, input)
  return response.data.data
}

export type AdminProduct = {
  id: string
  name: string
  slug: string
  description?: string | null
  status: string
  category: { id: string; name: string }
  images: Array<{ id: string; url: string; altText: string | null }>
  variants: Array<{ id: string; sku: string; price: number; stockOnHand: number; reservedStock: number; status: string; flavor: { name: string }; size: { name: string } }>
}

export type AdminTaxonomy = { id: string; name: string; slug: string; status: string; weightGrams?: number; unit?: string }
export type AdminCoupon = { id: string; code: string; type: string; value: number | string; status: string; startsAt: string; endsAt: string; usedCount: number; usageLimit: number | null }
export type AdminCustomer = { id: string; name: string; email: string; phone: string | null; status: string; createdAt: string; _count: { orders: number } }
export type SalesReportRow = { day: string; totalSales: number; orderCount: number }
export type AdminPromotion = { id: string; name: string; description: string | null; type: string; value: number | string; startsAt: string; endsAt: string; status: string; promotionProducts: Array<{ product: { id: string; name: string; slug: string } }> }

export async function getAdminProducts() {
  const response = await api.get<ApiResponse<AdminProduct[]>>('/admin/products')
  return response.data.data
}

export async function createAdminProduct(input: Record<string, unknown>) {
  const response = await api.post<ApiResponse<AdminProduct>>('/admin/products', input)
  return response.data.data
}

export async function updateAdminProduct(id: string, input: Record<string, unknown>) {
  const response = await api.patch<ApiResponse<AdminProduct>>(`/admin/products/${encodeURIComponent(id)}`, input)
  return response.data.data
}

export async function deleteAdminProduct(id: string) {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/admin/products/${encodeURIComponent(id)}`)
  return response.data.data
}

export async function updateAdminVariant(id: string, input: Record<string, unknown>) {
  const response = await api.patch<ApiResponse<{ id: string; price: number }>>(`/admin/variants/${encodeURIComponent(id)}`, input)
  return response.data.data
}

export async function getAdminTaxonomy(type: 'categories' | 'flavors' | 'sizes') {
  const response = await api.get<ApiResponse<AdminTaxonomy[]>>(`/admin/${type}`)
  return response.data.data
}

export async function createAdminTaxonomy(type: 'categories' | 'flavors' | 'sizes', input: Record<string, unknown>) {
  const response = await api.post<ApiResponse<AdminTaxonomy>>(`/admin/${type}`, input)
  return response.data.data
}

export async function getAdminCoupons() {
  const response = await api.get<ApiResponse<AdminCoupon[]>>('/admin/coupons')
  return response.data.data
}

export async function createAdminCoupon(input: Record<string, unknown>) {
  const response = await api.post<ApiResponse<AdminCoupon>>('/admin/coupons', input)
  return response.data.data
}

export async function getAdminCustomers(query?: string) {
  const response = await api.get<ApiResponse<AdminCustomer[]>>('/admin/customers', { params: query ? { q: query } : {} })
  return response.data.data
}

export async function getSalesReport(from: string, to: string) {
  const response = await api.get<ApiResponse<SalesReportRow[]>>('/admin/reports/sales', { params: { from, to } })
  return response.data.data
}

export async function getAdminPromotions() {
  const response = await api.get<ApiResponse<AdminPromotion[]>>('/admin/promotions')
  return response.data.data
}

export async function createAdminPromotion(input: Record<string, unknown>) {
  const response = await api.post<ApiResponse<AdminPromotion>>('/admin/promotions', input)
  return response.data.data
}