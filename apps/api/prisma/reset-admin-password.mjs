```javascript
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const prisma = new PrismaClient()

const rl = createInterface({ input: stdin, output: stdout })

async function main() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase()

  if (!email) {
    throw new Error('INITIAL_ADMIN_EMAIL belum diatur')
  }

  const password = await rl.question(
    'Masukkan password admin baru (minimal 12 karakter): ',
  )

  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password harus 12–72 byte')
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, status: true },
  })

  if (!user) {
    throw new Error('Akun dengan email tersebut tidak ditemukan')
  }

  if (user.role !== 'ADMIN') {
    throw new Error('Akun tersebut bukan ADMIN; password tidak diubah')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  console.log(`Password berhasil diperbarui untuk ${ user.email } `)
  console.log(`Role: ${ user.role }; status: ${ user.status } `)
}

main()
  .catch((error) => {
    console.error('Reset gagal:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    rl.close()
    await prisma.$disconnect()
  })
```