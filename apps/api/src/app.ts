import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { env } from './config/env.js'
import { errorHandler } from './middlewares/error-handler.js'
import { requestLogger } from './middlewares/request-logger.js'
import { healthRouter } from './routes/health.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { catalogRouter } from './routes/catalog.routes.js'
import { cartRouter } from './routes/cart.routes.js'
import { orderRouter } from './routes/order.routes.js'
import { shippingRouter } from './routes/shipping.routes.js'
import { adminRouter } from './routes/admin/index.js'
import { paymentRouter } from './routes/payment.routes.js'
import { addressRouter } from './routes/address.routes.js'
import { couponRouter } from './routes/coupon.routes.js'
import { promotionRouter } from './routes/promotion.routes.js'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)
const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    try {
      const url = new URL(origin)
      if (url.hostname.endsWith('.railway.app') || url.hostname.endsWith('.up.railway.app')) {
        return callback(null, true)
      }
    } catch {}
    // Di production, browser akan dapat CORS error yang jelas; non-browser tetap lolos via trustedOrigin
    return callback(null, false)
  },
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  handler: (_request, response) => {
    response.status(429).json({ success: false, message: 'Too many requests, please try again later', errors: [] })
  },
})
app.use(requestLogger)
app.use(globalRateLimit)

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/cart', cartRouter)
app.use('/api/orders', orderRouter)
app.use('/api/shipping', shippingRouter)
app.use('/api/payments', paymentRouter)
app.use('/api/addresses', addressRouter)
app.use('/api/coupons', couponRouter)
app.use('/api/promotions', promotionRouter)
app.use('/api/admin', adminRouter)
app.use('/api', catalogRouter)

// Di Railway image, Web dibuild ke apps/web/dist dan dibundle ke /app/apps/web/dist.
// Di local dev folder itu mungkin tidak ada — jadi guard dengan fs.existsSync.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const candidateWebPaths = [
  path.resolve(__dirname, '../../../apps/web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
  path.resolve(process.cwd(), '../web/dist'),
  path.resolve(process.cwd(), 'dist'),
]
const webDistPath = candidateWebPaths.find((candidate) => fs.existsSync(candidate))
if (webDistPath) {
  app.use(express.static(webDistPath))
  // SPA fallback: selain /api dan /api/health, serahkan ke index.html
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(webDistPath, 'index.html'))
  })
}

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: 'Route not found',
    errors: [],
  })
})

app.use(errorHandler)