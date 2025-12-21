/**
 * Structured logging utility for the application
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  toolName?: string;
  taskId?: string;
  [key: string]: unknown;
}

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

const LOG_ICONS = {
  debug: '🔍',
  info: '✅',
  warn: '⚠️',
  error: '❌',
};

class Logger {
  private name: string;
  private minLevel: LogLevel;

  constructor(name: string) {
    this.name = name;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const color = LOG_COLORS[level];
    const icon = LOG_ICONS[level];
    const reset = LOG_COLORS.reset;
    
    let formatted = `${color}${icon} [${timestamp}] [${this.name}] ${message}${reset}`;
    
    if (context && Object.keys(context).length > 0) {
      formatted += ` ${JSON.stringify(context)}`;
    }
    
    return formatted;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorInfo = error instanceof Error 
        ? { errorName: error.name, errorMessage: error.message }
        : { error: String(error) };
      console.error(this.formatMessage('error', message, { ...context, ...errorInfo }));
    }
  }

  // Create a child logger with a sub-namespace
  child(subName: string): Logger {
    return new Logger(`${this.name}:${subName}`);
  }
}

// Factory function to create loggers
export function createLogger(name: string): Logger {
  return new Logger(name);
}

// Pre-configured loggers for different modules
export const loggers = {
  agent: createLogger('Agent'),
  tools: createLogger('Tools'),
  auth: createLogger('Auth'),
  gmail: createLogger('Gmail'),
  calendar: createLogger('Calendar'),
  hubspot: createLogger('HubSpot'),
  rag: createLogger('RAG'),
  tasks: createLogger('Tasks'),
  poller: createLogger('EmailPoller'),
  proactive: createLogger('Proactive'),
  instructions: createLogger('Instructions'),
};

