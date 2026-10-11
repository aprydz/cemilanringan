import 'dotenv/config'
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './database/prisma.js'
import { startReservationExpiryWorker } from './jobs/expire-pending-orders.js'
import { logger } from './utils/logger.js'

let stopWorker: (() => void) | null = null

const server = app.listen(env.PORT, async () => {
  logger.info(`Piscokshop API listening on port ${env.PORT}`)
  stopWorker = await startReservationExpiryWorker()
})

const shutdown = async () => {
  try {
    stopWorker?.()
  } catch {}
  try {
    await prisma.$disconnect()
  } catch (error) {
    logger.error('Prisma disconnect failed during shutdown', error)
  }
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())