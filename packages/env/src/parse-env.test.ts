import { afterEach, beforeEach, describe, expect, it, vi, MockInstance } from 'vitest';
import z from 'zod';

import { HandleErrorFn, parseEnv } from './parse-env';

let processExit!: MockInstance<typeof process.exit>;
let processStderrWrite!: MockInstance<typeof console.error>;
let originalProcessEnv: NodeJS.ProcessEnv;

describe('parseEnv', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Store original process.env
    originalProcessEnv = process.env;

    // Mock process.exit to prevent actual exit
    processExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Mock process.stderr.write
    processStderrWrite = vi.spyOn(console, 'error').mockImplementation(() => undefined as never);

    // Reset process.env to a clean state
    process.env = {};
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalProcessEnv;
    vi.restoreAllMocks();
  });

  describe('with Zod schema', () => {
    it('should parse valid environment variables with Zod schema', () => {
      const schema = {
        NODE_ENV: z.enum(['development', 'production', 'test']),
        PORT: z.string().transform(Number),
        API_KEY: z.string().min(1),
        DEBUG: z.string().transform((val) => val === 'true'),
      };

      process.env = {
        NODE_ENV: 'development',
        PORT: '3000',
        API_KEY: 'secret-key',
        DEBUG: 'true',
      };

      const result = parseEnv(schema);

      expect(result).toStrictEqual({
        NODE_ENV: 'development',
        PORT: 3000,
        API_KEY: 'secret-key',
        DEBUG: true,
      });
    });

    it('should handle optional environment variables', () => {
      const schema = {
        REQUIRED: z.string(),
        OPTIONAL: z.string().optional(),
      };

      process.env = {
        REQUIRED: 'value',
      };

      const result = parseEnv(schema);

      expect(result).toStrictEqual({
        REQUIRED: 'value',
      });
    });

    it('should handle default values', () => {
      const schema = {
        NODE_ENV: z.string().default('development'),
        PORT: z.string().default('3000').transform(Number),
      };

      process.env = {};

      const result = parseEnv(schema);

      expect(result).toStrictEqual({
        NODE_ENV: 'development',
        PORT: 3000,
      });
    });
  });

  describe('with string array (rest parameters)', () => {
    it('should parse environment variables from string array using rest parameters', () => {
      const names = ['NODE_ENV', 'PORT', 'API_KEY'];

      process.env = {
        NODE_ENV: 'development',
        PORT: '3000',
        API_KEY: 'secret-key',
      };

      const result = parseEnv(...names);

      expect(result).toStrictEqual({
        NODE_ENV: 'development',
        PORT: '3000',
        API_KEY: 'secret-key',
      });
    });

    it('should handle empty string array', () => {
      const names: string[] = [];

      process.env = {};

      const result = parseEnv(...names);

      expect(result).toStrictEqual({});
    });

    it('should handle single string in array', () => {
      const names = ['SINGLE_VAR'];

      process.env = {
        SINGLE_VAR: 'value',
      };

      const result = parseEnv(...names);

      expect(result).toStrictEqual({
        SINGLE_VAR: 'value',
      });
    });
  });

  describe('error handling', () => {
    it('should use default error handler when none provided', () => {
      const schema = {
        REQUIRED: z.string(),
      };

      process.env = {};

      parseEnv(schema);

      expect(processStderrWrite).toHaveBeenCalledWith(expect.any(String));
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('should call custom error handler on validation error', () => {
      const schema = {
        REQUIRED: z.string(),
      };

      const customErrorHandler: HandleErrorFn<typeof schema> = vi.fn();

      process.env = {};

      parseEnv(schema, { handleError: customErrorHandler });

      expect(customErrorHandler).toHaveBeenCalledWith(expect.any(z.ZodError), expect.any(Array));
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('should allow error handler to recover by returning a value', () => {
      const schema = {
        REQUIRED: z.string(),
      };

      const recoveryValue = { REQUIRED: 'recovered-value' };
      const customErrorHandler: HandleErrorFn<typeof schema> = vi
        .fn()
        .mockReturnValue(recoveryValue);

      process.env = {};

      const result = parseEnv(schema, { handleError: customErrorHandler });

      expect(result).toStrictEqual(recoveryValue);
      expect(processExit).not.toHaveBeenCalled();
    });

    it('should handle custom error handler that returns undefined', () => {
      const schema = {
        REQUIRED: z.string(),
      };

      const customErrorHandler: HandleErrorFn<typeof schema> = vi.fn().mockReturnValue(undefined);

      process.env = {};

      parseEnv(schema, { handleError: customErrorHandler });

      expect(customErrorHandler).toHaveBeenCalledWith(expect.any(z.ZodError), expect.any(Array));
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Zod errors', () => {
      const schema = {
        PORT: z.string().transform(() => {
          throw new Error('Custom transformation error');
        }),
      };

      process.env = { PORT: '3000' };

      parseEnv(schema);

      expect(processStderrWrite).toHaveBeenCalledWith(expect.any(String));
      expect(processExit).toHaveBeenCalledWith(1);
    });
  });

  describe('type safety and edge cases', () => {
    it('should not convert underscores to objects and should exit with status 1 for complex nested schemas', () => {
      const schema = {
        DATABASE: z.object({
          HOST: z.string(),
          PORT: z.string().transform(Number),
          NAME: z.string(),
        }),
        REDIS: z.object({
          URL: z.url(),
        }),
      };

      process.env = {
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'myapp',
        REDIS_URL: 'redis://localhost:6379',
      };

      const result = parseEnv(schema);

      expect(result).toBeUndefined();
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('should handle empty string values', () => {
      const schema = {
        EMPTY_VAR: z.string(),
      };

      process.env = {
        EMPTY_VAR: '',
      };

      const result = parseEnv(schema);

      expect(result).toStrictEqual({
        EMPTY_VAR: '',
      });
    });

    it('should handle boolean-like strings', () => {
      const schema = {
        BOOLEAN_VAR: z.string().transform((val) => val === 'true'),
      };

      process.env = {
        BOOLEAN_VAR: 'false',
      };

      const result = parseEnv(schema);

      expect(result).toStrictEqual({
        BOOLEAN_VAR: false,
      });
    });

    it('should handle numeric strings', () => {
      const schema = {
        NUMERIC_VAR: z.string().transform(Number),
      };

      process.env = {
        NUMERIC_VAR: '42',
      };

      const result = parseEnv(schema);

      expect(result).toStrictEqual({
        NUMERIC_VAR: 42,
      });
    });

    it('should maintain correct types for Zod schema output', () => {
      const schema = {
        STRING_VAR: z.string(),
        NUMBER_VAR: z.string().transform(Number),
        BOOLEAN_VAR: z.string().transform((val) => val === 'true'),
      };

      process.env = {
        STRING_VAR: 'test',
        NUMBER_VAR: '42',
        BOOLEAN_VAR: 'true',
      };

      const result = parseEnv(schema);

      // TypeScript should infer these types correctly
      expect(typeof result.STRING_VAR).toBe('string');
      expect(typeof result.NUMBER_VAR).toBe('number');
      expect(typeof result.BOOLEAN_VAR).toBe('boolean');
    });

    it('should maintain correct types for string array output', () => {
      const names = ['VAR1', 'VAR2', 'VAR3'];

      process.env = {
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: 'value3',
      };

      const result = parseEnv(...names);

      // All values should be strings
      expect(result).toStrictEqual({
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: 'value3',
      });
      expect(typeof result.VAR1).toBe('string');
      expect(typeof result.VAR2).toBe('string');
      expect(typeof result.VAR3).toBe('string');
    });
  });

  describe('error handler function types', () => {
    it('should work with error handler that returns void', () => {
      const schema = {
        REQUIRED: z.string(),
      };

      const voidHandler: HandleErrorFn<typeof schema> = vi.fn().mockImplementation(() => {
        // Handler does something but returns void
        process.stderr.write('Custom error message\n');
      });

      process.env = {};

      parseEnv(schema, { handleError: voidHandler });

      expect(voidHandler).toHaveBeenCalledWith(expect.any(z.ZodError), expect.any(Array));
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('should work with error handler that returns a value', () => {
      const schema = {
        REQUIRED: z.string(),
      };

      const recoveryHandler: HandleErrorFn<typeof schema> = vi.fn().mockReturnValue({
        REQUIRED: 'recovered-value',
      });

      process.env = {};

      const result = parseEnv(schema, { handleError: recoveryHandler });

      expect(result).toStrictEqual({ REQUIRED: 'recovered-value' });
      expect(processExit).not.toHaveBeenCalled();
    });
  });

  describe('envPrefix functionality', () => {
    it('should filter environment variables by prefix', () => {
      const schema = {
        HOST: z.string(),
        PORT: z.string().transform(Number),
        NAME: z.string(),
      };

      process.env = {
        APP_HOST: 'localhost',
        APP_PORT: '3000',
        APP_NAME: 'myapp',
        OTHER_VAR: 'should-be-ignored',
      };

      const result = parseEnv(schema, { envPrefix: 'APP_' });

      expect(result).toStrictEqual({
        HOST: 'localhost',
        PORT: 3000,
        NAME: 'myapp',
      });
    });

    it('should work with empty prefix (same as no prefix)', () => {
      const schema = {
        TEST_VAR: z.string(),
      };

      process.env = {
        TEST_VAR: 'test-value',
      };

      const result = parseEnv(schema, { envPrefix: '' });

      expect(result).toStrictEqual({
        TEST_VAR: 'test-value',
      });
    });

    it('should handle prefix with no matching variables', () => {
      const schema = {
        MISSING_VAR: z.string(),
      };

      process.env = {
        OTHER_VAR: 'value',
      };

      parseEnv(schema, { envPrefix: 'MISSING_' });

      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('should work with string array and prefix', () => {
      const names = ['HOST', 'PORT'];

      process.env = {
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        OTHER_VAR: 'ignored',
      };

      const result = parseEnv(...names, { envPrefix: 'DB_' });

      expect(result).toStrictEqual({
        HOST: 'localhost',
        PORT: '5432',
      });
    });
  });
});
