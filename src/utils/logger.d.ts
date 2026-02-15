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
 * Get the current logger instance
 */
export declare function getLogger(): Logger;
/**
 * Set a custom logger implementation
 */
export declare function setLogger(logger: Logger): void;
/**
 * Reset to the default console logger
 */
export declare function resetLogger(): void;
/**
 * Disable all logging
 */
export declare function disableLogging(): void;
/**
 * Create a namespaced logger
 */
export declare function createNamespacedLogger(namespace: string): Logger;
export declare const logger: Logger;
