import type { RequestHandler } from 'express'
import { prisma } from '../database/prisma.js'
import { HttpError } from '../utils/http-error.js'
import { verifyAccessToken } from '../auth/auth.service.js'

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const [scheme, token] = request.header('authorization')?.split(' ') ?? []
  if (scheme !== 'Bearer' || !token) {
    next(new HttpError(401, 'Authentication is required'))
    return
  }

  try {
    const { userId } = verifyAccessToken(token)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    })

    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(401, 'Authentication is required')
    }

    request.authUser = { id: user.id, role: user.role }
    next()
  } catch (error) {
    next(error)
  }
}

export const requireRole = (...roles: Array<'CUSTOMER' | 'ADMIN'>): RequestHandler => (
  request,
  _response,
  next,
) => {
  if (!request.authUser) {
    next(new HttpError(401, 'Authentication is required'))
    return
  }

  if (!roles.includes(request.authUser.role)) {
    next(new HttpError(403, 'You do not have permission to perform this action'))
    return
  }

  next()
}

export const optionalAuth: RequestHandler = (request, response, next) => {
  if (!request.header('authorization')) {
    next()
    return
  }

  void requireAuth(request, response, next)
}