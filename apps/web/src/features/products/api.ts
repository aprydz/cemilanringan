import axios from 'axios'
import { api } from '../../lib/api'
import type { ApiResponse, CatalogCategory, CatalogFlavor, CatalogPromotion, CatalogSize, ProductCardData, ProductDetailData, ProductQuery } from './types'

export async function getProducts(query: ProductQuery = {}, signal?: AbortSignal) {
  const response = await api.get<ApiResponse<ProductCardData[]>>('/products', { params: query, signal })
  return response.data
}

export async function getProduct(slug: string, signal?: AbortSignal) {
  const response = await api.get<ApiResponse<ProductDetailData>>(`/products/${encodeURIComponent(slug)}`, { signal })
  return response.data.data
}

export async function getCategories(signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CatalogCategory[]>>('/categories', { signal })
  return response.data.data
}

export async function getFlavors(signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CatalogFlavor[]>>('/flavors', { signal })
  return response.data.data
}

export async function getSizes(signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CatalogSize[]>>('/sizes', { signal })
  return response.data.data
}

export function getRequestError(error: unknown) {
  if (axios.isAxiosError<{ message?: string; errors?: Array<{ field?: string; message: string }> }>(error)) {
    const errorDetails = error.response?.data?.errors
    if (errorDetails && errorDetails.length > 0) {
      const details = errorDetails.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join(', ')
      return `${error.response?.data?.message ?? 'Validasi gagal'}: ${details}`
    }
    return error.response?.data?.message ?? 'Layanan sedang tidak tersedia. Coba lagi sebentar.'
  }

  return 'Terjadi kendala saat memuat katalog.'
}

export async function getPromotions(signal?: AbortSignal) {
  const response = await api.get<ApiResponse<CatalogPromotion[]>>('/promotions', { signal })
  return response.data.data
}