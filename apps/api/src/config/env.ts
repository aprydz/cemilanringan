import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).optional(),
  SHIPPING_FLAT_RATE_IDR: z.coerce.number().int().nonnegative().optional(),
  PAYMENT_SERVER_KEY: z.string().min(16).optional(),
  PAYMENT_API_BASE_URL: z.string().url().default('https://app.sandbox.midtrans.com'),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),
}).superRefine((config, context) => {
  if (config.CLIENT_ORIGIN.split(',').length > 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CLIENT_ORIGIN must be a single URL; use comma-separated filtering in app.ts if needed',
      path: ['CLIENT_ORIGIN'],
    })
  }
  if (!config.JWT_ACCESS_SECRET) {
    if (config.NODE_ENV === 'production') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_ACCESS_SECRET must be configured',
        path: ['JWT_ACCESS_SECRET'],
      })
    }
  } else if (config.NODE_ENV === 'production' && config.JWT_ACCESS_SECRET.startsWith('local-only-')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_ACCESS_SECRET must be configured for production',
      path: ['JWT_ACCESS_SECRET'],
    })
  }
  if (config.NODE_ENV === 'production' && config.SHIPPING_FLAT_RATE_IDR === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SHIPPING_FLAT_RATE_IDR must be configured for production',
      path: ['SHIPPING_FLAT_RATE_IDR'],
    })
  }
  if (config.NODE_ENV === 'production' && !config.DATABASE_URL) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DATABASE_URL must be configured in production',
      path: ['DATABASE_URL'],
    })
  }
  if (config.NODE_ENV === 'production' && config.CLIENT_ORIGIN.includes('localhost')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CLIENT_ORIGIN must not be localhost in production',
      path: ['CLIENT_ORIGIN'],
    })
  }
  if (config.NODE_ENV === 'production' && (!config.PAYMENT_SERVER_KEY || config.PAYMENT_API_BASE_URL.includes('sandbox'))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Production payment credentials and non-sandbox API URL are required',
      path: ['PAYMENT_SERVER_KEY'],
    })
  }
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error(JSON.stringify({ level: 'error', message: 'Invalid environment configuration', errors: parsedEnv.error.flatten().fieldErrors, timestamp: new Date().toISOString() }))
  process.exit(1)
}

const DEV_FALLBACK_JWT_SECRET = 'local-only-access-secret-change-this-32'
export const env = {
  ...parsedEnv.data,
  JWT_ACCESS_SECRET: parsedEnv.data.JWT_ACCESS_SECRET ?? DEV_FALLBACK_JWT_SECRET,
} as typeof parsedEnv.data & { JWT_ACCESS_SECRET: string }