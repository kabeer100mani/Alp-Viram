import { env } from '@/config/env'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogFn = (message: string, context?: Record<string, unknown>) => void

interface Logger {
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
}

/**
 * The single logging choke point for the whole app. Swap the console sink here
 * for a real service (Sentry, Logtail, …) later without touching call sites.
 */
function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (level === 'debug' && !env.isDevelopment) return
  const payload = context ? { message, ...context } : { message }
  const method = level === 'debug' ? 'log' : level
  console[method](`[${level.toUpperCase()}]`, payload)
}

export const logger: Logger = {
  debug: (message, context) => write('debug', message, context),
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
}
