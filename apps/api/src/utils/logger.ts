type Level = 'info' | 'warn' | 'error' | 'debug'

const isProduction = process.env.NODE_ENV === 'production'

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    const err = value as Error & { code?: unknown; cause?: unknown; meta?: unknown }
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.code !== undefined ? { code: err.code } : {}),
      ...(err.cause !== undefined ? { cause: serialize(err.cause) } : {}),
      ...((err as unknown as Record<string, unknown>).meta !== undefined
        ? { meta: serialize((err as unknown as Record<string, unknown>).meta) }
        : {}),
    }
  }
  if (Array.isArray(value)) return value.map(serialize)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serialize(val)
    }
    return out
  }
  return value
}

function fmt(level: Level, message: string, meta?: unknown) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta !== undefined ? { meta: serialize(meta) } : {}),
  }
  return JSON.stringify(entry)
}

export const logger = {
  info(message: string, meta?: unknown) {
    if (isProduction) console.log(fmt('info', message, meta))
    else console.log(`[info] ${message}`, meta !== undefined ? serialize(meta) : '')
  },
  warn(message: string, meta?: unknown) {
    if (isProduction) console.warn(fmt('warn', message, meta))
    else console.warn(`[warn] ${message}`, meta !== undefined ? serialize(meta) : '')
  },
  error(message: string, meta?: unknown) {
    if (isProduction) console.error(fmt('error', message, meta))
    else console.error(`[error] ${message}`, meta !== undefined ? serialize(meta) : '')
  },
  debug(message: string, meta?: unknown) {
    if (!isProduction) console.debug(`[debug] ${message}`, meta !== undefined ? serialize(meta) : '')
  },
}
