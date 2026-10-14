import dotenv from 'dotenv'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../src/database/prisma.js'

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
})
dotenv.config({
  path: path.resolve(process.cwd(), '../../.env'),
})

const adminInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
})

async function createAdmin() {
  const input = adminInputSchema.parse({
    name: process.env.INITIAL_ADMIN_NAME,
    email: process.env.INITIAL_ADMIN_EMAIL,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  })

  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })
  if (existing) throw new Error('An account with this email already exists; bootstrap does not modify existing accounts')

  await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  console.log(`Admin account created for ${input.email}`)
}

createAdmin()
  .catch((error: unknown) => {
    console.error('Admin provisioning failed', error instanceof Error ? error.message : 'Unexpected error')
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())