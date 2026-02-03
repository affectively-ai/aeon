/**
 * Aeon Logger Interface
 *
 * Provides a pluggable logging interface that can be configured
 * by consumers to integrate with their preferred logging solution.
 */

/**
 * Logger interface that consumers can implement
 */
export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Default console logger implementation
 */
const consoleLogger: Logger = {
  debug: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.debug('[AEON:DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.info('[AEON:INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn('[AEON:WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error('[AEON:ERROR]', ...args);
  },
};

/**
 * No-op logger for production or when logging is disabled
 */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Current logger instance
 */
let currentLogger: Logger = consoleLogger;

/**
 * Get the current logger instance
 */
export function getLogger(): Logger {
  return currentLogger;
}

/**
 * Set a custom logger implementation
 */
export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

/**
 * Reset to the default console logger
 */
export function resetLogger(): void {
  currentLogger = consoleLogger;
}

/**
 * Disable all logging
 */
export function disableLogging(): void {
  currentLogger = noopLogger;
}

/**
 * Create a namespaced logger
 */
export function createNamespacedLogger(namespace: string): Logger {
  const logger = getLogger();
  return {
    debug: (...args: unknown[]) => logger.debug(`[${namespace}]`, ...args),
    info: (...args: unknown[]) => logger.info(`[${namespace}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${namespace}]`, ...args),
    error: (...args: unknown[]) => logger.error(`[${namespace}]`, ...args),
  };
}

// Export default logger for convenience
export const logger: Logger = {
  debug: (...args: unknown[]) => getLogger().debug(...args),
  info: (...args: unknown[]) => getLogger().info(...args),
  warn: (...args: unknown[]) => getLogger().warn(...args),
  error: (...args: unknown[]) => getLogger().error(...args),
};
