import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { HttpError } from '../utils/http-error.js'

export const trustedOrigin: RequestHandler = (request, _response, next) => {
  // P0-1: skip trusted-origin on non-browser clients that never send Origin/Referer
  const hasBrowserContext =
    Boolean(request.get('sec-fetch-site')) ||
    request.get('sec-fetch-mode') === 'cors' ||
    Boolean(request.get('origin')) ||
    Boolean(request.get('referer'))
  if (!hasBrowserContext) {
    next()
    return
  }

  const origin = request.get('origin') ?? request.get('referer')
  if (origin) {
    let originUrl: URL | null = null
    try {
      originUrl = new URL(origin)
    } catch {
      next(new HttpError(403, 'Request origin is not allowed'))
      return
    }
    if (originUrl.origin !== env.CLIENT_ORIGIN) {
      next(new HttpError(403, 'Request origin is not allowed'))
      return
    }
  }

  // Browser request without a parsable Origin but with Sec-Fetch-Site still passes;
  // same-origin / no-cors navigations rely on CORS + SameSite cookie protection.
  next()
}