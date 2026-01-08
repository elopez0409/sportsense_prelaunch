// Structured logging utility for production observability

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level based on environment
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (better for log aggregation)
    return JSON.stringify(entry);
  }
  
  // Human-readable format for development
  const { level, message, timestamp, context, error } = entry;
  let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  if (context && Object.keys(context).length > 0) {
    output += ` | ${JSON.stringify(context)}`;
  }
  
  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.stack) {
      output += `\n  Stack: ${error.stack}`;
    }
  }
  
  return output;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (context) {
    entry.context = context;
  }
  
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  
  return entry;
}

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): void {
  if (!shouldLog(level)) return;
  
  const entry = createLogEntry(level, message, context, error);
  const formatted = formatLog(entry);
  
  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

// ============================================
// PUBLIC LOGGER API
// ============================================

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log('debug', message, context),
  
  info: (message: string, context?: Record<string, unknown>) =>
    log('info', message, context),
  
  warn: (message: string, context?: Record<string, unknown>, error?: Error) =>
    log('warn', message, context, error),
  
  error: (message: string, context?: Record<string, unknown>, error?: Error) =>
    log('error', message, context, error),
  
  // Specialized loggers for different subsystems
  api: {
    request: (method: string, path: string, context?: Record<string, unknown>) =>
      log('info', `API ${method} ${path}`, { ...context, subsystem: 'api' }),
    
    error: (method: string, path: string, error: Error, context?: Record<string, unknown>) =>
      log('error', `API ${method} ${path} failed`, { ...context, subsystem: 'api' }, error),
  },
  
  data: {
    sync: (source: string, action: string, context?: Record<string, unknown>) =>
      log('info', `[${source}] ${action}`, { ...context, subsystem: 'data-sync' }),
    
    error: (source: string, action: string, error: Error, context?: Record<string, unknown>) =>
      log('error', `[${source}] ${action} failed`, { ...context, subsystem: 'data-sync' }, error),
  },
  
  ai: {
    invoke: (model: string, promptType: string, context?: Record<string, unknown>) =>
      log('info', `Gemini ${model}: ${promptType}`, { ...context, subsystem: 'ai' }),
    
    error: (model: string, promptType: string, error: Error, context?: Record<string, unknown>) =>
      log('error', `Gemini ${model}: ${promptType} failed`, { ...context, subsystem: 'ai' }, error),
  },
  
  cache: {
    hit: (key: string) =>
      log('debug', `Cache HIT: ${key}`, { subsystem: 'cache' }),
    
    miss: (key: string) =>
      log('debug', `Cache MISS: ${key}`, { subsystem: 'cache' }),
  },
};

export default logger;




