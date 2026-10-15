import dotenv from 'dotenv'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient, RecordStatus } from '@prisma/client'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

const prisma = new PrismaClient()

const categorySeeds = [
  { name: 'Camilan Pedas', slug: 'camilan-pedas', description: 'Camilan gurih dengan pilihan rasa pedas.' },
  { name: 'Keripik', slug: 'keripik', description: 'Keripik renyah untuk teman santai.' },
  { name: 'Manis', slug: 'manis', description: 'Pilihan camilan dengan rasa manis.' },
]

const flavorSeeds = [
  { name: 'Original', slug: 'original' },
  { name: 'Balado', slug: 'balado' },
  { name: 'BBQ', slug: 'bbq' },
  { name: 'Pedas Daun Jeruk', slug: 'pedas-daun-jeruk' },
  { name: 'Cokelat', slug: 'cokelat' },
  { name: 'Keju', slug: 'keju' },
]

const sizeSeeds = [
  { name: '100 gram', slug: '100-gram', weightGrams: 100 },
  { name: '250 gram', slug: '250-gram', weightGrams: 250 },
  { name: '500 gram', slug: '500-gram', weightGrams: 500 },
]

const productSeeds = [
  {
    name: 'Basreng',
    slug: 'basreng',
    category: 'camilan-pedas',
    description: 'Bakso goreng renyah dengan rasa pilihan.',
    flavors: ['original', 'balado', 'bbq', 'pedas-daun-jeruk'],
    sizes: ['100-gram', '250-gram', '500-gram'],
    skuPrefix: 'BSR',
    basePrice: 10000,
    image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=1200&q=85',
  },
  {
    name: 'Keripik Singkong',
    slug: 'keripik-singkong',
    category: 'keripik',
    description: 'Keripik singkong tipis dengan tekstur renyah.',
    flavors: ['original', 'balado', 'bbq'],
    sizes: ['100-gram', '250-gram'],
    skuPrefix: 'KSG',
    basePrice: 9000,
    image: 'https://images.unsplash.com/photo-1621939514649-280e2aa2f3e5?auto=format&fit=crop&w=1200&q=85',
  },
  {
    name: 'Pisang Cokelat',
    slug: 'pisang-cokelat',
    category: 'manis',
    description: 'Camilan pisang dengan pilihan rasa manis dan gurih.',
    flavors: ['cokelat', 'keju'],
    sizes: ['100-gram', '250-gram'],
    skuPrefix: 'PSC',
    basePrice: 12000,
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=85',
  },
]

async function provisionAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.INITIAL_ADMIN_PASSWORD?.trim()
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || 'Admin Piscokshop'

  if (!email) {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, email: true },
    })
    if (existingAdmin) {
      console.log(`[init-db] Admin account already active: ${existingAdmin.email}`)
    } else {
      console.warn('[init-db] WARNING: No admin user exists and INITIAL_ADMIN_EMAIL is not set in environment.')
    }
    return
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  })

  if (existing) {
    const updateData = { role: 'ADMIN', status: RecordStatus.ACTIVE }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12)
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: updateData,
    })
    console.log(`[init-db] Admin account ${email} confirmed as ADMIN${password ? ' (password synced with INITIAL_ADMIN_PASSWORD)' : ''}.`)
    return
  }

  if (!password) {
    console.warn(`[init-db] User ${email} does not exist yet, and INITIAL_ADMIN_PASSWORD is not provided. Cannot create new admin.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      status: RecordStatus.ACTIVE,
    },
  })

  console.log(`[init-db] Successfully created initial ADMIN account: ${email}`)
}

async function seedCatalogIfEmpty() {
  const categoryCount = await prisma.category.count()
  if (categoryCount > 0) {
    console.log(`[init-db] Catalog already initialized (${categoryCount} categories found). Skipping seed.`)
    return
  }

  console.log('[init-db] Catalog empty, seeding default categories, flavors, sizes, and products...')

  const categories = new Map()
  for (const category of categorySeeds) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description, status: RecordStatus.ACTIVE },
      create: { ...category, status: RecordStatus.ACTIVE },
    })
    categories.set(category.slug, saved.id)
  }

  const flavors = new Map()
  for (const flavor of flavorSeeds) {
    const saved = await prisma.flavor.upsert({
      where: { slug: flavor.slug },
      update: { name: flavor.name, status: RecordStatus.ACTIVE },
      create: { ...flavor, status: RecordStatus.ACTIVE },
    })
    flavors.set(flavor.slug, saved.id)
  }

  const sizes = new Map()
  for (const size of sizeSeeds) {
    const saved = await prisma.size.upsert({
      where: { slug: size.slug },
      update: { name: size.name, weightGrams: size.weightGrams, status: RecordStatus.ACTIVE },
      create: { ...size, unit: 'g', status: RecordStatus.ACTIVE },
    })
    sizes.set(size.slug, { id: saved.id, weightGrams: saved.weightGrams })
  }

  for (const productSeed of productSeeds) {
    const product = await prisma.product.upsert({
      where: { slug: productSeed.slug },
      update: {
        name: productSeed.name,
        description: productSeed.description,
        categoryId: categories.get(productSeed.category),
        status: RecordStatus.ACTIVE,
      },
      create: {
        name: productSeed.name,
        slug: productSeed.slug,
        description: productSeed.description,
        categoryId: categories.get(productSeed.category),
        status: RecordStatus.ACTIVE,
      },
    })

    await prisma.productImage.deleteMany({ where: { productId: product.id } })
    await prisma.productImage.create({
      data: { productId: product.id, url: productSeed.image, altText: productSeed.name, sortOrder: 0 },
    })

    for (const flavorSlug of productSeed.flavors) {
      for (const sizeSlug of productSeed.sizes) {
        const flavorId = flavors.get(flavorSlug)
        const size = sizes.get(sizeSlug)
        const sizeSuffix = size.weightGrams.toString().padStart(3, '0')
        const flavorCode = flavorSlug.split('-').map((part) => part.slice(0, 3).toUpperCase()).join('')
        const sku = `${productSeed.skuPrefix}-${flavorCode}-${sizeSuffix}`
        const price = productSeed.basePrice + Math.max(0, (size.weightGrams - 100) / 100) * 5000

        const existing = await prisma.productVariant.findUnique({ where: { sku } })
        if (existing) {
          await prisma.productVariant.update({
            where: { id: existing.id },
            data: { productId: product.id, flavorId, sizeId: size.id, price, weightGrams: size.weightGrams, status: RecordStatus.ACTIVE },
          })
        } else {
          const variant = await prisma.productVariant.create({
            data: {
              productId: product.id,
              flavorId,
              sizeId: size.id,
              sku,
              price,
              weightGrams: size.weightGrams,
              stockOnHand: 24,
              status: RecordStatus.ACTIVE,
            },
          })
          await prisma.inventoryLog.create({
            data: {
              productVariantId: variant.id,
              type: 'IN',
              quantity: 24,
              referenceType: 'SEED',
              referenceId: 'initial-catalog',
              note: 'Initial catalog stock',
            },
          })
        }
      }
    }
  }

  console.log('[init-db] Catalog seed completed successfully.')
}

async function main() {
  try {
    await provisionAdmin()
    await seedCatalogIfEmpty()
  } catch (error) {
    console.error('[init-db] Initialization encountered an issue:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
