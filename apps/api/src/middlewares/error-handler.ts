import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/http-error.js'
import { logger } from '../utils/logger.js'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(422).json({
      success: false,
      message: 'Request validation failed',
      errors: error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    })
    return
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
    })
    return
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    response.status(409).json({ success: false, message: 'A record with this value already exists', errors: [] })
    return
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
    response.status(404).json({ success: false, message: 'Record not found', errors: [] })
    return
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003') {
    response.status(409).json({ success: false, message: 'Related record constraint failed', errors: [] })
    return
  }

  if (error instanceof SyntaxError && 'body' in (error as unknown as Record<string, unknown>)) {
    response.status(400).json({ success: false, message: 'Malformed JSON body', errors: [] })
    return
  }

  logger.error('Unhandled request error', { error: error instanceof Error ? { message: error.message, stack: error.stack } : error })
  response.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
    errors: [],
  })
}