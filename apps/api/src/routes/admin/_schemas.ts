import { DiscountType, OrderStatus, RecordStatus } from '@prisma/client'
import { z } from 'zod'

export const orderStatusSchema = z.object({ status: z.nativeEnum(OrderStatus) }).strict()

export const cuidSchema = z.string().cuid()
export const cuidArraySchema = z.array(cuidSchema).max(100)

export const inventoryAdjustmentSchema = z.object({
  variantId: cuidSchema,
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  quantity: z.coerce.number().int().nonnegative().max(100000),
  note: z.string().trim().max(500).optional(),
}).strict()

export const shippingUpdateSchema = z.object({
  courier: z.string().trim().min(2).max(80),
  service: z.string().trim().min(2).max(80),
  trackingNumber: z.string().trim().max(120).optional(),
  shippingCost: z.coerce.number().int().nonnegative(),
}).strict()

export const variantCreateSchema = z.object({
  flavorId: cuidSchema,
  sizeId: cuidSchema,
  sku: z.string().trim().min(2).max(100),
  price: z.coerce.number().int().nonnegative(),
  weightGrams: z.coerce.number().int().positive(),
  image: z.string().url().max(2048).optional(),
  initialStock: z.coerce.number().int().nonnegative().max(100000).default(0),
}).strict()

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  categoryId: cuidSchema,
  description: z.string().trim().max(10000).optional(),
  images: z.array(z.object({ url: z.string().url().max(2048), altText: z.string().max(255).optional() }).strict()).max(12).default([]),
  variants: z.array(variantCreateSchema.omit({ initialStock: true }).extend({ initialStock: variantCreateSchema.shape.initialStock })).min(1).max(100),
}).strict()

export const productUpdateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  categoryId: cuidSchema.optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  status: z.nativeEnum(RecordStatus).optional(),
}).strict()

export const variantUpdateSchema = variantCreateSchema.omit({ flavorId: true, sizeId: true, initialStock: true }).partial().strict()

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(10000).optional(),
  image: z.string().url().max(2048).optional(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
}).strict()

export const taxonomySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
}).strict()

export const sizeSchema = taxonomySchema.extend({
  weightGrams: z.coerce.number().int().positive(),
  unit: z.string().trim().min(1).max(10).default('g'),
}).strict()

export const couponSchema = z.object({
  code: z.string().trim().min(3).max(80).transform((value) => value.toUpperCase()),
  type: z.nativeEnum(DiscountType),
  value: z.coerce.number().nonnegative(),
  minimumPurchase: z.coerce.number().int().nonnegative().default(0),
  maximumDiscount: z.coerce.number().int().positive().optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
}).strict().refine(({ type, value }) => type !== DiscountType.PERCENTAGE || value <= 100, { message: 'Percentage coupon cannot exceed 100', path: ['value'] })
  .refine(({ startsAt, endsAt }) => startsAt < endsAt, { message: 'Coupon end must be after start', path: ['endsAt'] })

export const promotionSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(10000).optional(),
  type: z.nativeEnum(DiscountType),
  value: z.coerce.number().nonnegative(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
  productIds: cuidArraySchema.default([]),
}).strict().refine(({ type, value }) => type !== DiscountType.PERCENTAGE || value <= 100, { message: 'Percentage promotion cannot exceed 100', path: ['value'] })
  .refine(({ startsAt, endsAt }) => startsAt < endsAt, { message: 'Promotion end must be after start', path: ['endsAt'] })

export const couponUpdateSchema = z.object({
  code: z.string().trim().min(3).max(80).transform((value) => value.toUpperCase()).optional(),
  type: z.nativeEnum(DiscountType).optional(),
  value: z.coerce.number().nonnegative().optional(),
  minimumPurchase: z.coerce.number().int().nonnegative().optional(),
  maximumDiscount: z.coerce.number().int().positive().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  status: z.nativeEnum(RecordStatus).optional(),
}).strict().refine(({ type, value }) => type !== DiscountType.PERCENTAGE || value === undefined || value <= 100, { message: 'Percentage coupon cannot exceed 100', path: ['value'] })
  .refine(({ startsAt, endsAt }) => !startsAt || !endsAt || startsAt < endsAt, { message: 'Coupon end must be after start', path: ['endsAt'] })

export const promotionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  type: z.nativeEnum(DiscountType).optional(),
  value: z.coerce.number().nonnegative().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  status: z.nativeEnum(RecordStatus).optional(),
  productIds: cuidArraySchema.optional(),
}).strict().refine(({ type, value }) => type !== DiscountType.PERCENTAGE || value === undefined || value <= 100, { message: 'Percentage promotion cannot exceed 100', path: ['value'] })
  .refine(({ startsAt, endsAt }) => !startsAt || !endsAt || startsAt < endsAt, { message: 'Promotion end must be after start', path: ['endsAt'] })

export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING'],
  PROCESSING: ['PACKING'],
  PACKING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(30),
}).strict()
