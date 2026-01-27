type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: Error
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]
}

function formatLogEntry(entry: LogEntry): string {
  const parts = [`[${entry.timestamp}]`, `[${entry.level.toUpperCase()}]`, entry.message]

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context))
  }

  return parts.join(' ')
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error,
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return
    const entry = createLogEntry('debug', message, context)
    console.debug(formatLogEntry(entry))
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return
    const entry = createLogEntry('info', message, context)
    console.info(formatLogEntry(entry))
  },

  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return
    const entry = createLogEntry('warn', message, context)
    console.warn(formatLogEntry(entry))
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!shouldLog('error')) return

    const errorObj = error instanceof Error ? error : undefined
    const entry = createLogEntry('error', message, context, errorObj)

    console.error(formatLogEntry(entry))

    if (errorObj) {
      console.error('Stack trace:', errorObj.stack)
    }

    // Send to external error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      reportToErrorService(entry, errorObj)
    }
  },

  // Log API errors with request context
  apiError(
    message: string,
    error: unknown,
    request?: { method?: string; url?: string; body?: unknown }
  ): void {
    this.error(message, error, {
      type: 'api_error',
      request: request
        ? {
            method: request.method,
            url: request.url,
            body: typeof request.body === 'object' ? '[object]' : request.body,
          }
        : undefined,
    })
  },

  // Log database errors with query context
  dbError(message: string, error: unknown, query?: { table?: string; operation?: string }): void {
    this.error(message, error, {
      type: 'db_error',
      query,
    })
  },

  // Log authentication errors
  authError(message: string, error?: unknown, userId?: string): void {
    this.error(message, error, {
      type: 'auth_error',
      userId,
    })
  },
}

// Placeholder for external error service integration
function reportToErrorService(_entry: LogEntry, _error?: Error): void {
  // Integration with Sentry, LogRocket, etc. would go here
  // Example:
  // if (typeof Sentry !== 'undefined') {
  //   Sentry.captureException(error || new Error(entry.message), {
  //     level: entry.level,
  //     extra: entry.context,
  //   })
  // }
}

// Export for use in catch blocks
export function captureException(error: unknown, context?: LogContext): void {
  const message = error instanceof Error ? error.message : 'Unknown error'
  logger.error(message, error, context)
}

export default logger
