import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../database/prisma.js'
import { HttpError } from '../utils/http-error.js'

const passwordRounds = 12
const accessTokenTtlSeconds = 15 * 60
const refreshCookieName = 'piscokshop_refresh'
let cachedDummyHash: string | null = null
const getDummyPasswordHash = async () => {
  if (cachedDummyHash) return cachedDummyHash
  try {
    cachedDummyHash = await bcrypt.hash('constant timing value', passwordRounds)
  } catch {
    cachedDummyHash = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  }
  return cachedDummyHash
}

type AuthResult = {
  user: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'createdAt'>
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
}

const createRefreshToken = () => randomBytes(48).toString('base64url')
const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex')

const createAccessToken = (user: Pick<User, 'id' | 'role'>) => jwt.sign(
  { role: user.role },
  env.JWT_ACCESS_SECRET,
  {
    subject: user.id,
    expiresIn: accessTokenTtlSeconds,
    issuer: 'piscokshop-api',
    audience: 'piscokshop-client',
    algorithm: 'HS256',
  },
)

const startSession = async (user: User): Promise<AuthResult> => {
  const refreshToken = createRefreshToken()
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)

  await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt,
    },
  })

  return {
    user,
    accessToken: createAccessToken(user),
    refreshToken,
    refreshExpiresAt,
  }
}

export const register = async (input: {
  name: string
  email: string
  password: string
  phone?: string
}): Promise<AuthResult> => {
  const passwordHash = await bcrypt.hash(input.password, passwordRounds)
  const refreshToken = createRefreshToken()
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  const refreshTokenHash = hashRefreshToken(refreshToken)

  const user = await prisma.$transaction(async (transaction) => {
    const createdUser = await transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone,
      },
    })

    await transaction.authSession.create({
      data: { userId: createdUser.id, refreshTokenHash, expiresAt: refreshExpiresAt },
    })

    return createdUser
  })

  return {
    user,
    accessToken: createAccessToken(user),
    refreshToken,
    refreshExpiresAt,
  }
}

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email } })
  const passwordHash = user?.passwordHash ?? await getDummyPasswordHash()
  const passwordMatches = await bcrypt.compare(password, passwordHash)

  if (!user || !passwordMatches) {
    throw new HttpError(401, 'Email or password is incorrect')
  }

  if (user.status !== 'ACTIVE') {
    throw new HttpError(403, 'This account is unavailable')
  }

  return startSession(user)
}

export const refreshSession = async (refreshToken: string): Promise<AuthResult> => {
  const tokenHash = hashRefreshToken(refreshToken)
  const existingSession = await prisma.authSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { user: true },
  })

  if (!existingSession) {
    throw new HttpError(401, 'Refresh session is invalid or expired')
  }

  if (existingSession.revokedAt) {
    await prisma.authSession.updateMany({
      where: { userId: existingSession.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    throw new HttpError(401, 'Refresh session reuse detected; sign in again')
  }

  if (existingSession.expiresAt <= new Date() || existingSession.user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Refresh session is invalid or expired')
  }

  const nextRefreshToken = createRefreshToken()
  const nextRefreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken)

  const rotated = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.authSession.updateMany({
      where: { id: existingSession.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    })

    if (claimed.count !== 1) {
      return false
    }

    await transaction.authSession.create({
      data: {
        userId: existingSession.userId,
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt: nextRefreshExpiresAt,
      },
    })

    return true
  })

  if (!rotated) {
    throw new HttpError(401, 'Refresh session is invalid or expired')
  }

  return {
    user: existingSession.user,
    accessToken: createAccessToken(existingSession.user),
    refreshToken: nextRefreshToken,
    refreshExpiresAt: nextRefreshExpiresAt,
  }
}

export const revokeRefreshSession = async (refreshToken?: string) => {
  if (!refreshToken) return

  await prisma.authSession.updateMany({
    where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export const verifyAccessToken = (token: string): { userId: string } => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'piscokshop-api',
      audience: 'piscokshop-client',
      algorithms: ['HS256'],
    })

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new HttpError(401, 'Access token is invalid or expired')
    }

    return { userId: payload.sub }
  } catch {
    throw new HttpError(401, 'Access token is invalid or expired')
  }
}

export const refreshCookie = {
  name: refreshCookieName,
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
    path: '/api/auth',
  },
}

export const refreshCookieMaxAge = (expiresAt: Date) => Math.max(0, expiresAt.getTime() - Date.now())