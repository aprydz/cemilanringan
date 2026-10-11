import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../database/prisma.js'
import { requireAuth } from '../middlewares/require-auth.js'
import { trustedOrigin } from '../middlewares/trusted-origin.js'
import { HttpError } from '../utils/http-error.js'
import { login, refreshCookie, refreshCookieMaxAge, refreshSession, register, revokeRefreshSession } from '../auth/auth.service.js'

export const authRouter = Router()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  handler: (_request, response) => {
    response.status(429).json({ success: false, message: 'Too many authentication attempts', errors: [] })
  },
})

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(6).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must not exceed 72 bytes'),
  phone: z.string().trim().max(30).optional(),
}).strict()

const loginSchema = z.object({
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must not exceed 72 bytes'),
}).strict()

const publicUser = ({ id, name, email, phone, role, createdAt }: {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  createdAt: Date
}) => ({ id, name, email, phone, role, createdAt })

const setRefreshCookie = (response: import('express').Response, token: string, expiresAt: Date) => {
  response.cookie(refreshCookie.name, token, {
    ...refreshCookie.options,
    maxAge: refreshCookieMaxAge(expiresAt),
  })
}

authRouter.post('/register', authRateLimit, trustedOrigin, async (request, response) => {
  const input = registerSchema.parse(request.body)
  const auth = await register(input)
  setRefreshCookie(response, auth.refreshToken, auth.refreshExpiresAt)
  response.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user: publicUser(auth.user), accessToken: auth.accessToken },
  })
})

authRouter.post('/login', authRateLimit, trustedOrigin, async (request, response) => {
  const input = loginSchema.parse(request.body)
  const auth = await login(input.email, input.password)
  setRefreshCookie(response, auth.refreshToken, auth.refreshExpiresAt)
  response.status(200).json({
    success: true,
    message: 'Signed in successfully',
    data: { user: publicUser(auth.user), accessToken: auth.accessToken },
  })
})

authRouter.post('/refresh', trustedOrigin, async (request, response) => {
  const token = request.cookies?.[refreshCookie.name]
  if (typeof token !== 'string') {
    throw new HttpError(401, 'Refresh session is invalid or expired')
  }

  const auth = await refreshSession(token)
  setRefreshCookie(response, auth.refreshToken, auth.refreshExpiresAt)
  response.status(200).json({
    success: true,
    message: 'Session refreshed successfully',
    data: { user: publicUser(auth.user), accessToken: auth.accessToken },
  })
})

authRouter.post('/logout', trustedOrigin, async (request, response) => {
  await revokeRefreshSession(request.cookies?.[refreshCookie.name])
  response.clearCookie(refreshCookie.name, refreshCookie.options)
  response.status(200).json({ success: true, message: 'Signed out successfully', data: null })
})

authRouter.get('/me', requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.authUser!.id },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  })

  if (!user) {
    throw new HttpError(401, 'Authentication is required')
  }

  response.status(200).json({ success: true, message: 'Current user retrieved', data: publicUser(user) })
})