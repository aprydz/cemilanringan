import dotenv from 'dotenv'
import path from 'node:path'
import { PrismaClient, RecordStatus } from '@prisma/client'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') })
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

const prisma = new PrismaClient()

async function main() {
  const targetEmail = (process.argv[2] || process.env.INITIAL_ADMIN_EMAIL)?.trim().toLowerCase()

  if (!targetEmail) {
    console.error('Usage: node prisma/promote-admin.mjs <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, name: true, email: true, role: true, status: true },
  })

  if (!user) {
    console.error(`User with email "${targetEmail}" was not found in the database.`)
    process.exit(1)
  }

  if (user.role === 'ADMIN' && user.status === RecordStatus.ACTIVE) {
    console.log(`User ${user.email} (${user.name}) is already an ACTIVE ADMIN.`)
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN', status: RecordStatus.ACTIVE },
  })

  console.log(`SUCCESS: User ${user.email} (${user.name}) has been upgraded to ADMIN role.`)
}

main()
  .catch((err) => {
    console.error('Failed to promote user:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
