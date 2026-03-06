'use strict';
/**
 * Aeon Logger Interface
 *
 * Provides a pluggable logging interface that can be configured
 * by consumers to integrate with their preferred logging solution.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.logger = void 0;
exports.getLogger = getLogger;
exports.setLogger = setLogger;
exports.resetLogger = resetLogger;
exports.disableLogging = disableLogging;
exports.createNamespacedLogger = createNamespacedLogger;
/**
 * Default console logger implementation
 */
const consoleLogger = {
  debug: (...args) => {
    // eslint-disable-next-line no-console
    console.debug('[AEON:DEBUG]', ...args);
  },
  info: (...args) => {
    // eslint-disable-next-line no-console
    console.info('[AEON:INFO]', ...args);
  },
  warn: (...args) => {
    // eslint-disable-next-line no-console
    console.warn('[AEON:WARN]', ...args);
  },
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error('[AEON:ERROR]', ...args);
  },
};
/**
 * No-op logger for production or when logging is disabled
 */
const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
/**
 * Current logger instance
 */
let currentLogger = consoleLogger;
/**
 * Get the current logger instance
 */
function getLogger() {
  return currentLogger;
}
/**
 * Set a custom logger implementation
 */
function setLogger(logger) {
  currentLogger = logger;
}
/**
 * Reset to the default console logger
 */
function resetLogger() {
  currentLogger = consoleLogger;
}
/**
 * Disable all logging
 */
function disableLogging() {
  currentLogger = noopLogger;
}
/**
 * Create a namespaced logger
 */
function createNamespacedLogger(namespace) {
  const logger = getLogger();
  return {
    debug: (...args) => logger.debug(`[${namespace}]`, ...args),
    info: (...args) => logger.info(`[${namespace}]`, ...args),
    warn: (...args) => logger.warn(`[${namespace}]`, ...args),
    error: (...args) => logger.error(`[${namespace}]`, ...args),
  };
}
// Export default logger for convenience
exports.logger = {
  debug: (...args) => getLogger().debug(...args),
  info: (...args) => getLogger().info(...args),
  warn: (...args) => getLogger().warn(...args),
  error: (...args) => getLogger().error(...args),
};
//# sourceMappingURL=logger.js.map
