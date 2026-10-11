import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
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
app.use(helmet())
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  handler: (_request, response) => {
    response.status(429).json({ success: false, message: 'Too many requests, please try again later', errors: [] })
  },
})
app.use(globalRateLimit)
app.use(requestLogger)

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

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: 'Route not found',
    errors: [],
  })
})

app.use(errorHandler)