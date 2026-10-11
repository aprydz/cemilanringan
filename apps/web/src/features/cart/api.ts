import { api } from '../../lib/api'

export type CartData = {
  items: Array<{
    id: string
    variantId: string
    product: { id: string; name: string; slug: string; image: string | null }
    flavor: { name: string; slug: string }
    size: { name: string; slug: string; weightGrams: number; unit: string }
    sku: string
    unitPrice: number
    listPrice: number
    promotionDiscount: number
    promotionName: string | null
    quantity: number
    subtotal: number
    availableStock: number
    isAvailable: boolean
    isQuantityValid: boolean
  }>
  subtotal: number
  itemCount: number
}

type CartEnvelope = { success: boolean; message: string; data: CartData }

export async function getCart(signal?: AbortSignal) {
  const response = await api.get<CartEnvelope>('/cart', { signal })
  return response.data.data
}

export async function addCartItem(variantId: string, quantity: number) {
  const response = await api.post<CartEnvelope>('/cart/items', { variantId, quantity })
  return response.data.data
}

export async function updateCartItem(id: string, quantity: number) {
  const response = await api.patch<CartEnvelope>(`/cart/items/${encodeURIComponent(id)}`, { quantity })
  return response.data.data
}

export async function removeCartItem(id: string) {
  const response = await api.delete<CartEnvelope>(`/cart/items/${encodeURIComponent(id)}`)
  return response.data.data
}

export async function clearCart() {
  const response = await api.delete<CartEnvelope>('/cart')
  return response.data.data
}