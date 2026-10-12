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
  // Railway: CLIENT_ORIGIN boleh ","-separated untuk allow beberapa origin.
  // Validasi tiap origin harus URL valid, bukan hard-fail single URL.
  for (const origin of config.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      new URL(origin)
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `CLIENT_ORIGIN contains invalid URL: ${origin}`,
        path: ['CLIENT_ORIGIN'],
      })
    }
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
    console.warn(JSON.stringify({ level: 'warn', message: 'CLIENT_ORIGIN is still localhost in production — set Railway Variables CLIENT_ORIGIN to your https://<app>.up.railway.app domain for correct CORS', received: config.CLIENT_ORIGIN, timestamp: new Date().toISOString() }))
  }
  // Payment opsional saat awal deploy — cukup warn bila pakai sandbox di prod, jangan block app start.
  // Nanti saat butuh Midtrans production, isi PAYMENT_SERVER_KEY + PAYMENT_API_BASE_URL non-sandbox.
  if (config.NODE_ENV === 'production' && config.PAYMENT_SERVER_KEY && config.PAYMENT_API_BASE_URL.includes('sandbox')) {
    console.warn(JSON.stringify({ level: 'warn', message: 'PAYMENT_API_BASE_URL still sandbox in production — switch to production Midtrans URL before live payments', timestamp: new Date().toISOString() }))
  }
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  const flat = parsedEnv.error.flatten()
  console.error(JSON.stringify({ level: 'error', message: 'Invalid environment configuration', fieldErrors: flat.fieldErrors, formErrors: flat.formErrors, allIssues: parsedEnv.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: String(i.code) })), timestamp: new Date().toISOString() }))
  // Juga print raw issues agar tidak ter-filter oleh Railway log formatter
  for (const issue of parsedEnv.error.issues) {
    console.error(`ENV ERROR [${issue.path.join('.') || '(root)'}]: ${issue.message}`)
  }
  process.exit(1)
}

const DEV_FALLBACK_JWT_SECRET = 'local-only-access-secret-change-this-32'
export const env = {
  ...parsedEnv.data,
  JWT_ACCESS_SECRET: parsedEnv.data.JWT_ACCESS_SECRET ?? DEV_FALLBACK_JWT_SECRET,
} as typeof parsedEnv.data & { JWT_ACCESS_SECRET: string }