export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
  meta?: { page: number; limit: number; total: number }
}

export type ProductCardData = {
  id: string
  slug: string
  name: string
  description: string | null
  category: { id: string; name: string; slug: string }
  image: string | null
  startingPrice: number
  listPrice: number
  promotionDiscount: number
  promotionName: string | null
  availableStock: number
  flavorCount: number
  flavors: Array<{ id: string; name: string; slug: string }>
}

export type ProductDetailData = {
  id: string
  slug: string
  name: string
  description: string | null
  category: { id: string; name: string; slug: string }
  images: Array<{ id: string; url: string; altText: string | null }>
  variants: Array<{
    id: string
    sku: string
    price: number
    listPrice: number
    promotionDiscount: number
    promotionName: string | null
    weightGrams: number
    stockOnHand: number
    reservedStock: number
    availableStock: number
    image: string | null
    flavor: { id: string; name: string; slug: string }
    size: { id: string; name: string; slug: string; weightGrams: number; unit: string }
  }>
}

export type CatalogCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
}

export type CatalogFlavor = { id: string; name: string; slug: string }
export type CatalogSize = { id: string; name: string; slug: string; weightGrams: number; unit: string }
export type CatalogPromotion = { id: string; name: string; description: string | null; type: 'FIXED' | 'PERCENTAGE'; value: number; endsAt: string; products: Array<{ id: string; name: string; slug: string }> }

export type ProductQuery = {
  q?: string
  category?: string
  flavor?: string
  size?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'newest' | 'name_asc' | 'price_asc' | 'price_desc'
  page?: number
  limit?: number
}