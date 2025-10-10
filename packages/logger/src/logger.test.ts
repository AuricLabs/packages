import pino from 'pino';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { configureLogger, createLogger, logger } from './logger';

// Mock environment detection
vi.mock('@auriclabs/env', () => ({
  getEnvironment: () => 'test',
  isLocal: () => true,
}));

describe('createLogger', () => {
  let capturedLogs: { component?: string; componentColor?: string; msg?: string }[] = [];
  let mockWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedLogs = [];
    mockWrite = vi.fn((obj: string) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(obj);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      capturedLogs.push(parsed);
    });

    // Reconfigure logger with a mock stream to capture logs
    const mockStream = {
      write: mockWrite,
    };

    // Manually create a logger with our mock stream
    const testLogger = pino(
      {
        level: 'trace',
        base: {
          environment: 'test',
        },
        messageKey: 'msg',
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      mockStream,
    );

    // Replace the global logger
    Object.defineProperty(logger, 'info', {
      value: testLogger.info.bind(testLogger),
      writable: true,
    });
    Object.defineProperty(logger, 'error', {
      value: testLogger.error.bind(testLogger),
      writable: true,
    });
    Object.defineProperty(logger, 'warn', {
      value: testLogger.warn.bind(testLogger),
      writable: true,
    });
    Object.defineProperty(logger, 'debug', {
      value: testLogger.debug.bind(testLogger),
      writable: true,
    });
    Object.defineProperty(logger, 'child', {
      value: testLogger.child.bind(testLogger),
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('component name', () => {
    it('should create a child logger with component name', () => {
      const componentLogger = createLogger('PricingService');

      componentLogger.info('test message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PricingService',
        msg: 'test message',
      });
    });

    it('should create multiple child loggers with different component names', () => {
      const pricingLogger = createLogger('PricingService');
      const userLogger = createLogger('UserService');
      const orderLogger = createLogger('OrderService');

      pricingLogger.info('pricing message');
      userLogger.info('user message');
      orderLogger.info('order message');

      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PricingService',
        msg: 'pricing message',
      });
      expect(capturedLogs[1]).toMatchObject({
        component: 'UserService',
        msg: 'user message',
      });
      expect(capturedLogs[2]).toMatchObject({
        component: 'OrderService',
        msg: 'order message',
      });
    });

    it('should preserve component name across multiple log calls', () => {
      const componentLogger = createLogger('TestService');

      componentLogger.info('first message');
      componentLogger.warn('second message');
      componentLogger.error('third message');

      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs[0].component).toBe('TestService');
      expect(capturedLogs[1].component).toBe('TestService');
      expect(capturedLogs[2].component).toBe('TestService');
    });

    it('should return a logger instance', () => {
      const componentLogger = createLogger('TestService');

      expect(componentLogger).toBeDefined();
      expect(typeof componentLogger.info).toBe('function');
      expect(typeof componentLogger.error).toBe('function');
      expect(typeof componentLogger.warn).toBe('function');
      expect(typeof componentLogger.debug).toBe('function');
    });
  });

  describe('component color', () => {
    it('should create a child logger with component name and color', () => {
      const componentLogger = createLogger('PricingService', { componentColor: 'cyan' });

      componentLogger.info('test message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PricingService',
        componentColor: 'cyan',
        msg: 'test message',
      });
    });

    it('should create child loggers with different colors', () => {
      const pricingLogger = createLogger('PricingService', { componentColor: 'cyan' });
      const userLogger = createLogger('UserService', { componentColor: 'magenta' });
      const orderLogger = createLogger('OrderService', { componentColor: 'brightGreen' });

      pricingLogger.info('pricing message');
      userLogger.info('user message');
      orderLogger.info('order message');

      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PricingService',
        componentColor: 'cyan',
      });
      expect(capturedLogs[1]).toMatchObject({
        component: 'UserService',
        componentColor: 'magenta',
      });
      expect(capturedLogs[2]).toMatchObject({
        component: 'OrderService',
        componentColor: 'brightGreen',
      });
    });

    it('should support all standard colors', () => {
      const standardColors = ['cyan', 'magenta', 'blue', 'green', 'yellow', 'red', 'gray', 'white'];

      standardColors.forEach((color, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const componentLogger = createLogger(`Service${index}`, { componentColor: color as any });
        componentLogger.info(`message ${index}`);
      });

      expect(capturedLogs).toHaveLength(standardColors.length);
      standardColors.forEach((color, index) => {
        expect(capturedLogs[index].componentColor).toBe(color);
      });
    });

    it('should support all bright colors', () => {
      const brightColors = [
        'brightBlue',
        'brightGreen',
        'brightYellow',
        'brightMagenta',
        'brightCyan',
      ];

      brightColors.forEach((color, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        const componentLogger = createLogger(`Service${index}`, { componentColor: color as any });
        componentLogger.info(`message ${index}`);
      });

      expect(capturedLogs).toHaveLength(brightColors.length);
      brightColors.forEach((color, index) => {
        expect(capturedLogs[index].componentColor).toBe(color);
      });
    });

    it('should preserve color across multiple log calls', () => {
      const componentLogger = createLogger('TestService', { componentColor: 'brightBlue' });

      componentLogger.info('first message');
      componentLogger.warn('second message');
      componentLogger.error('third message');

      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs[0].componentColor).toBe('brightBlue');
      expect(capturedLogs[1].componentColor).toBe('brightBlue');
      expect(capturedLogs[2].componentColor).toBe('brightBlue');
    });

    it('should create logger without color when not specified', () => {
      const componentLogger = createLogger('PricingService');

      componentLogger.info('test message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PricingService',
        msg: 'test message',
      });
      expect(capturedLogs[0].componentColor).toBeUndefined();
    });
  });

  describe('nested child loggers', () => {
    it('should support creating child loggers from component loggers', () => {
      const serviceLogger = createLogger('UserService', { componentColor: 'cyan' });
      const methodLogger = serviceLogger.child({ method: 'createUser' });

      methodLogger.info('creating user');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'UserService',
        componentColor: 'cyan',
        method: 'createUser',
        msg: 'creating user',
      });
    });

    it('should allow overriding component in nested child', () => {
      const serviceLogger = createLogger('UserService', { componentColor: 'cyan' });
      const nestedLogger = serviceLogger.child({
        component: 'UserRepository',
        componentColor: 'magenta',
      });

      nestedLogger.info('nested message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'UserRepository',
        componentColor: 'magenta',
        msg: 'nested message',
      });
    });
  });

  describe('additional context', () => {
    it('should support logging with additional context', () => {
      const componentLogger = createLogger('PricingService', { componentColor: 'cyan' });

      componentLogger.info({ userId: '123', price: 99.99 }, 'calculated price');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PricingService',
        componentColor: 'cyan',
        userId: '123',
        price: 99.99,
        msg: 'calculated price',
      });
    });

    it('should support logging errors with component', () => {
      const componentLogger = createLogger('PaymentService', { componentColor: 'red' });
      const error = new Error('Payment failed');

      componentLogger.error({ err: error }, 'payment processing failed');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0]).toMatchObject({
        component: 'PaymentService',
        componentColor: 'red',
        msg: 'payment processing failed',
      });
      // @ts-expect-error test for err
      expect(capturedLogs[0].err).toBeDefined();
    });
  });

  describe('component naming patterns', () => {
    it('should support PascalCase component names', () => {
      const componentLogger = createLogger('UserAuthService');
      componentLogger.info('test');

      expect(capturedLogs[0].component).toBe('UserAuthService');
    });

    it('should support kebab-case component names', () => {
      const componentLogger = createLogger('user-auth-service');
      componentLogger.info('test');

      expect(capturedLogs[0].component).toBe('user-auth-service');
    });

    it('should support snake_case component names', () => {
      const componentLogger = createLogger('user_auth_service');
      componentLogger.info('test');

      expect(capturedLogs[0].component).toBe('user_auth_service');
    });

    it('should support namespaced component names', () => {
      const componentLogger = createLogger('API.Users.Controller');
      componentLogger.info('test');

      expect(capturedLogs[0].component).toBe('API.Users.Controller');
    });

    it('should support short component names', () => {
      const componentLogger = createLogger('DB');
      componentLogger.info('test');

      expect(capturedLogs[0].component).toBe('DB');
    });
  });
});

describe('configureLogger', () => {
  it('should configure logger with default settings when no config provided', () => {
    expect(() => {
      configureLogger();
    }).not.toThrow();
  });

  it('should configure logger with webhook urls', () => {
    expect(() => {
      configureLogger({
        microsoftTeamsWebhookUrl: 'https://example.com/webhook',
        slackWebhookUrl: 'https://example.com/slack',
      });
    }).not.toThrow();
  });
});
