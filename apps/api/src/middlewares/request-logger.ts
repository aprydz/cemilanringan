import type { RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import { logger } from '../utils/logger.js'

export const requestLogger: RequestHandler = (request, response, next) => {
  const requestId = (request.get('x-request-id') as string) || randomUUID()
  response.setHeader('x-request-id', requestId)
  ;(request as unknown as { requestId: string }).requestId = requestId

  const start = Date.now()
  response.on('finish', () => {
    const duration = Date.now() - start
    const userId = (request as unknown as { authUser?: { id: string } }).authUser?.id
    logger.info('request', {
      requestId,
      method: request.method,
      path: request.originalUrl,
      status: response.statusCode,
      durationMs: duration,
      userId: userId ?? null,
      ip: request.ip,
    })
  })

  next()
}
