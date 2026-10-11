import { Prisma, RecordStatus } from '@prisma/client'
import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../database/prisma.js'
import { HttpError } from '../utils/http-error.js'
import { calculateEffectivePrice, type EligiblePromotion } from '../promotions/promotion.service.js'

export const catalogRouter = Router()

const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(160).optional(),
  flavor: z.string().trim().max(120).optional(),
  size: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(['newest', 'name_asc', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(48).default(12),
}).strict().refine(
  ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
  { message: 'minPrice must be less than or equal to maxPrice', path: ['minPrice'] },
)

const activeProductWhere = (query: z.infer<typeof productQuerySchema>): Prisma.ProductWhereInput => ({
  status: RecordStatus.ACTIVE,
  category: { is: { status: RecordStatus.ACTIVE, ...(query.category ? { slug: query.category } : {}) } },
  ...(query.q
    ? { OR: [{ name: { contains: query.q } }, { description: { contains: query.q } }] }
    : {}),
})

const activeVariantWhere = (query: z.infer<typeof productQuerySchema>): Prisma.ProductVariantWhereInput => ({
  status: RecordStatus.ACTIVE,
  flavor: { is: { status: RecordStatus.ACTIVE, ...(query.flavor ? { slug: query.flavor } : {}) } },
  size: { is: { status: RecordStatus.ACTIVE, ...(query.size ? { slug: query.size } : {}) } },
})

const productListInclude = (now: Date) => ({
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  promotionProducts: {
    where: { promotion: { is: { status: RecordStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gt: now } } } },
    include: { promotion: { select: { name: true, type: true, value: true } } },
  },
  variants: {
    where: {
      status: RecordStatus.ACTIVE,
      flavor: { is: { status: RecordStatus.ACTIVE } },
      size: { is: { status: RecordStatus.ACTIVE } },
    },
    select: {
      price: true,
      stockOnHand: true,
      reservedStock: true,
      image: true,
      flavor: { select: { id: true, name: true, slug: true } },
      size: { select: { id: true, name: true, slug: true } },
    },
  },
})

type CatalogVariant = {
  price: Prisma.Decimal
  stockOnHand: number
  reservedStock: number
  image: string | null
  flavor: { id: string; name: string; slug: string }
  size: { id: string; name: string; slug: string }
}

const productCard = (product: {
  id: string
  slug: string
  name: string
  description: string | null
  category: { id: string; name: string; slug: string }
  images: Array<{ url: string }>
  promotionProducts: Array<{ promotion: EligiblePromotion }>
  variants: CatalogVariant[]
}, variants = product.variants) => {
  // Return null if there are no variants to avoid errors in price calculations
  if (!variants || variants.length === 0) {
    return null;
  }
  const promotions = product.promotionProducts.map(({ promotion }) => promotion);
  const prices = variants.map(({ price }) => calculateEffectivePrice(price, promotions));
  const cheapest = prices.reduce((best, price) => price.unitPrice.lessThan(best.unitPrice) ? price : best);
  const flavors = [...new Map(variants.map(({ flavor }) => [flavor.id, flavor])).values()];

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    image: product.images[0]?.url ?? variants.find(({ image }) => image)?.image ?? null,
    startingPrice: Number(cheapest.unitPrice),
    listPrice: Number(cheapest.listPrice),
    promotionDiscount: Number(cheapest.promotionDiscount),
    promotionName: cheapest.promotionName,
    availableStock: variants.reduce((total, variant) => total + variant.stockOnHand - variant.reservedStock, 0),
    flavorCount: flavors.length,
    flavors,
  };
};

// Helper type for product cards
type ProductCard = ReturnType<typeof productCard>;

// Helper type for filtered matching items
type MatchingItem = { product: CatalogProduct; card: ProductCard };

type CatalogProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  category: { id: string; name: string; slug: string }
  images: Array<{ url: string }>
  promotionProducts: Array<{ promotion: EligiblePromotion }>
  variants: CatalogVariant[]
}



catalogRouter.get('/products', async (request: Request, response: Response) => {
  const query = productQuerySchema.parse(request.query) as z.infer<typeof productQuerySchema>
  const productWhere = activeProductWhere(query)
  const variantWhere = activeVariantWhere(query)
  const where: Prisma.ProductWhereInput = {
    ...productWhere,
    variants: { some: variantWhere },
  }
  const skip = (query.page - 1) * query.limit
  const now = new Date()
  const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined
  const needsPriceComputation = hasPriceFilter || query.sort === 'price_asc' || query.sort === 'price_desc'
  const hasActivePromotion = await prisma.promotion.count({ where: { status: RecordStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gt: now } } }).then((count) => count > 0)

  // When promotions are inactive, effectivePrice === listPrice, so price filter/sort can be pushed to DB.
  const canPushPriceToDb = !hasActivePromotion

  let responseProducts
  let responseTotal

  if (!needsPriceComputation) {
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productListInclude(now),
        orderBy: query.sort === 'name_asc' ? { name: 'asc' } : { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ])
    responseTotal = total
    responseProducts = products
      .map((product) => productCard(product as CatalogProduct, (product as CatalogProduct).variants.filter((variant) =>
        (!query.flavor || variant.flavor.slug === query.flavor) && (!query.size || variant.size.slug === query.size)
      )))
      .filter((card): card is ProductCard => card !== null);
  } else if (canPushPriceToDb) {
    // Cheap path: no active promotions → filter/sort on variant.price directly in SQL
    const priceWhere: Prisma.ProductVariantWhereInput = {
      ...(query.minPrice !== undefined ? { price: { gte: new Prisma.Decimal(query.minPrice) } } : {}),
      ...(query.maxPrice !== undefined ? { price: { lte: new Prisma.Decimal(query.maxPrice) } } : {}),
    }
    // Merge with flavor/size constraints for product selection
    const priceAwareVariantWhere: Prisma.ProductVariantWhereInput = { ...variantWhere, ...priceWhere }
    const priceAwareWhere: Prisma.ProductWhereInput = { ...productWhere, variants: { some: priceAwareVariantWhere } }
    // Count after price filtering
    const [total, products] = await Promise.all([
      prisma.product.count({ where: priceAwareWhere }),
      prisma.product.findMany({
        where: priceAwareWhere,
        include: productListInclude(now),
        orderBy: query.sort === 'price_asc' || query.sort === 'price_desc'
          ? undefined
          : query.sort === 'name_asc' ? { name: 'asc' } : { createdAt: 'desc' },
        ...(query.sort === 'price_asc' || query.sort === 'price_desc' ? {} : { skip, take: query.limit }),
      }),
    ])
    if (query.sort === 'price_asc' || query.sort === 'price_desc') {
      const cards = (products as CatalogProduct[]).map((product) => {
        const filtered = product.variants.filter((variant) =>
          (!query.flavor || variant.flavor.slug === query.flavor) && (!query.size || variant.size.slug === query.size)
          && (query.minPrice === undefined || Number(variant.price) >= query.minPrice)
          && (query.maxPrice === undefined || Number(variant.price) <= query.maxPrice)
        )
        return { product, card: productCard(product, filtered) }
      }).filter((item): item is MatchingItem => item.card !== null)
      cards.sort((left, right) => query.sort === 'price_asc'
        ? left.card!.startingPrice - right.card!.startingPrice
        : right.card!.startingPrice - left.card!.startingPrice)
      responseTotal = cards.length
      responseProducts = cards.slice(skip, skip + query.limit).map(({ card }) => card)
    } else {
      responseTotal = total
      responseProducts = (products as CatalogProduct[]).map((product) => {
        const filtered = product.variants.filter((variant) =>
          (!query.flavor || variant.flavor.slug === query.flavor) && (!query.size || variant.size.slug === query.size)
          && (query.minPrice === undefined || Number(variant.price) >= query.minPrice)
          && (query.maxPrice === undefined || Number(variant.price) <= query.maxPrice)
        )
        return productCard(product, filtered)
      }).filter((card): card is ProductCard => card !== null)
    }
  } else {
    // Fallback: promotions active → must compute effective price in JS.
    // Caps DB scan to 500 candidates; warn when truncation affects pagination.
    const MAX_SCAN = 500
    const products = await prisma.product.findMany({ where, include: productListInclude(now), take: MAX_SCAN })
    if (products.length === MAX_SCAN) {
      const { logger } = await import('../utils/logger.js')
      logger.warn('catalog price-filter scan truncated', { maxScan: MAX_SCAN, hasActivePromotion, minPrice: query.minPrice, maxPrice: query.maxPrice })
    }
    const matching = (products as CatalogProduct[]).flatMap((product) => {
      const promotions = product.promotionProducts.map(({ promotion }) => promotion)
      const variants = product.variants.filter((variant) => {
        if (query.flavor && variant.flavor.slug !== query.flavor) return false
        if (query.size && variant.size.slug !== query.size) return false
        const effectivePrice = Number(calculateEffectivePrice(variant.price, promotions).unitPrice)
        return (query.minPrice === undefined || effectivePrice >= query.minPrice)
          && (query.maxPrice === undefined || effectivePrice <= query.maxPrice)
      })
      return variants.length === 0 ? [] : [{ product, card: productCard(product, variants) }]
    })
    const filtered = matching.filter((item): item is MatchingItem => item.card !== null)

    if (query.sort === 'price_asc' || query.sort === 'price_desc') filtered.sort((left, right) => query.sort === 'price_asc'
      ? (left.card!.startingPrice - right.card!.startingPrice)
      : (right.card!.startingPrice - left.card!.startingPrice))

    responseTotal = filtered.length
    responseProducts = filtered.slice(skip, skip + query.limit).map(({ card }) => card)
  }

  response.status(200).json({
    success: true,
    message: 'Products retrieved successfully',
    data: responseProducts,
    meta: { page: query.page, limit: query.limit, total: responseTotal },
  })
})

catalogRouter.get('/products/:slug', async (request: Request, response: Response) => {
  const slug = z.string().min(1).max(200).parse(request.params.slug)
  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: RecordStatus.ACTIVE,
      category: { is: { status: RecordStatus.ACTIVE } },
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' } },
      promotionProducts: {
        where: { promotion: { is: { status: RecordStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } } },
        include: { promotion: { select: { name: true, type: true, value: true } } },
      },
      variants: {
        where: {
          status: RecordStatus.ACTIVE,
          flavor: { is: { status: RecordStatus.ACTIVE } },
          size: { is: { status: RecordStatus.ACTIVE } },
        },
        orderBy: { sku: 'asc' },
        include: {
          flavor: { select: { id: true, name: true, slug: true } },
          size: { select: { id: true, name: true, slug: true, weightGrams: true, unit: true } },
        },
      },
    },
  })

  if (!product || product.variants.length === 0) {
    throw new HttpError(404, 'Product not found')
  }

  response.status(200).json({
    success: true,
    message: 'Product retrieved successfully',
    data: {
      ...product,
      promotionProducts: undefined,
      variants: product.variants.map((variant) => {
        const effectivePrice = calculateEffectivePrice(variant.price, product.promotionProducts.map(({ promotion }) => promotion))
        return {
          ...variant,
          price: Number(effectivePrice.unitPrice),
          listPrice: Number(effectivePrice.listPrice),
          promotionDiscount: Number(effectivePrice.promotionDiscount),
          promotionName: effectivePrice.promotionName,
          availableStock: variant.stockOnHand - variant.reservedStock,
        }
      }),
    },
  })
})

catalogRouter.get('/categories', async (_request: Request, response: Response) => {
  const categories = await prisma.category.findMany({
    where: { status: RecordStatus.ACTIVE, products: { some: { status: RecordStatus.ACTIVE } } },
    select: { id: true, name: true, slug: true, description: true, image: true },
    orderBy: { name: 'asc' },
  })

  response.status(200).json({
    success: true,
    message: 'Categories retrieved successfully',
    data: categories,
  })
})

catalogRouter.get('/flavors', async (_request: Request, response: Response) => {
  const flavors = await prisma.flavor.findMany({
    where: { status: RecordStatus.ACTIVE, variants: { some: { status: RecordStatus.ACTIVE, product: { is: { status: RecordStatus.ACTIVE } } } } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })

  response.status(200).json({ success: true, message: 'Flavors retrieved successfully', data: flavors })
})

catalogRouter.get('/sizes', async (_request: Request, response: Response) => {
  const sizes = await prisma.size.findMany({
    where: { status: RecordStatus.ACTIVE, variants: { some: { status: RecordStatus.ACTIVE, product: { is: { status: RecordStatus.ACTIVE } } } } },
    select: { id: true, name: true, slug: true, weightGrams: true, unit: true },
    orderBy: { weightGrams: 'asc' },
  })

  response.status(200).json({ success: true, message: 'Sizes retrieved successfully', data: sizes })
})