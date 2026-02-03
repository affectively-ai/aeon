import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getLogger,
  setLogger,
  resetLogger,
  disableLogging,
  createNamespacedLogger,
  logger,
  type Logger,
} from '../../utils/logger';

describe('Logger Module', () => {
  beforeEach(() => {
    // Reset to default before each test
    resetLogger();
  });

  describe('getLogger', () => {
    it('should return a logger instance', () => {
      const log = getLogger();
      expect(log).toBeDefined();
      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
    });
  });

  describe('setLogger', () => {
    it('should set a custom logger', () => {
      const customLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      setLogger(customLogger);

      const log = getLogger();
      log.info('test message');

      expect(customLogger.info).toHaveBeenCalled();
    });
  });

  describe('resetLogger', () => {
    it('should reset to default logger', () => {
      const customLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      setLogger(customLogger);
      resetLogger();

      const log = getLogger();
      // After reset, should be using console logger, not custom
      log.info('test');
      expect(customLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('disableLogging', () => {
    it('should disable all logging', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      disableLogging();

      const log = getLogger();
      log.debug('this should not log');

      // After disabling, no-op logger is used
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('createNamespacedLogger', () => {
    it('should create a logger with namespace prefix', () => {
      const customLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      setLogger(customLogger);

      const nsLogger = createNamespacedLogger('MyModule');

      nsLogger.debug('debug message');
      nsLogger.info('info message');
      nsLogger.warn('warn message');
      nsLogger.error('error message');

      expect(customLogger.debug).toHaveBeenCalledWith('[MyModule]', 'debug message');
      expect(customLogger.info).toHaveBeenCalledWith('[MyModule]', 'info message');
      expect(customLogger.warn).toHaveBeenCalledWith('[MyModule]', 'warn message');
      expect(customLogger.error).toHaveBeenCalledWith('[MyModule]', 'error message');
    });
  });

  describe('logger (default export)', () => {
    it('should proxy to the current logger', () => {
      const customLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      setLogger(customLogger);

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(customLogger.debug).toHaveBeenCalled();
      expect(customLogger.info).toHaveBeenCalled();
      expect(customLogger.warn).toHaveBeenCalled();
      expect(customLogger.error).toHaveBeenCalled();
    });
  });
});
