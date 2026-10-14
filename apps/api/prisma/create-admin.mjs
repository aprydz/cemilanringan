import dotenv from 'dotenv'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

const prisma = new PrismaClient()

const schema = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(191).transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(72).refine((v) => Buffer.byteLength(v, 'utf8') <= 72),
})

async function main() {
    const input = schema.parse({
        name: process.env.INITIAL_ADMIN_NAME,
        email: process.env.INITIAL_ADMIN_EMAIL,
        password: process.env.INITIAL_ADMIN_PASSWORD,
    })

    const existing = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
    })

    if (existing) {
        throw new Error('An account with this email already exists; no changes made')
    }

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

main()
    .catch((error) => {
        console.error('Admin provisioning failed:', error.message)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
