type Level = 'info' | 'warn' | 'error' | 'debug'

const isProduction = process.env.NODE_ENV === 'production'

function fmt(level: Level, message: string, meta?: unknown) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta !== undefined ? { meta } : {}),
  }
  return JSON.stringify(entry)
}

export const logger = {
  info(message: string, meta?: unknown) {
    if (isProduction) console.log(fmt('info', message, meta))
    else console.log(`[info] ${message}`, meta ?? '')
  },
  warn(message: string, meta?: unknown) {
    if (isProduction) console.warn(fmt('warn', message, meta))
    else console.warn(`[warn] ${message}`, meta ?? '')
  },
  error(message: string, meta?: unknown) {
    if (isProduction) console.error(fmt('error', message, meta))
    else console.error(`[error] ${message}`, meta ?? '')
  },
  debug(message: string, meta?: unknown) {
    if (!isProduction) console.debug(`[debug] ${message}`, meta ?? '')
  },
}
