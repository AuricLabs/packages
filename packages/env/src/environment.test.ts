import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  configureEnvironment,
  getEnvironmentConfig,
  parseEnvironmentValue,
  getEnvironmentCategory,
  isEnvironmentInCategory,
  getEnvironment,
  setEnvironment,
  isEnvironment,
  resetEnvironment,
  isProd,
  isNonProd,
  isLocal,
  isProduction,
  getEnvironmentsInCategory,
  getAllEnvironments,
  getAllCategories,
  type EnvironmentConfig,
} from './environment';

let originalProcessEnv: NodeJS.ProcessEnv;
let originalConsoleWarn: typeof console.warn;

describe('environment', () => {
  beforeEach(() => {
    // Store original process.env
    originalProcessEnv = process.env;
    originalConsoleWarn = console.warn;

    // Mock console.warn to prevent test output noise
    jest.spyOn(console, 'warn').mockImplementation(() => undefined as never);

    // Reset process.env to a clean state
    process.env = {};
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalProcessEnv;
    console.warn = originalConsoleWarn;
    jest.restoreAllMocks();
  });

  describe('configuration', () => {
    it('should configure environment with custom settings', () => {
      const customConfig: Partial<EnvironmentConfig> = {
        environments: ['local', 'production', 'production'],
        categories: {
          local: 'non-production',
          staging: 'production',
          production: 'production',
        },
        aliases: {
          dev: 'local',
          prod: 'production',
        },
        defaultEnvironment: 'local',
      };

      configureEnvironment(customConfig);
      const config = getEnvironmentConfig();

      expect(config.environments).toStrictEqual(['local', 'production', 'production']);
      expect(config.categories.local).toBe('non-production');
      expect(config.aliases?.dev).toBe('local');
      expect(config.defaultEnvironment).toBe('local');
    });

    it('should merge with default configuration', () => {
      configureEnvironment({
        environments: ['custom'],
        categories: { custom: 'non-production' },
      });

      const config = getEnvironmentConfig();
      expect(config.environments).toStrictEqual(['custom']);
      expect(config.categories.custom).toBe('non-production');
      // Should still have default aliases
      expect(config.aliases?.prod).toBe('production');
    });
  });

  describe('parseEnvironmentValue', () => {
    beforeEach(() => {
      // Use a simple configuration for testing
      configureEnvironment({
        environments: ['local', 'production', 'production'],
        categories: {
          local: 'non-production',
          staging: 'production',
          production: 'production',
        },
        aliases: {
          dev: 'local',
          prod: 'production',
          stg: 'production',
        },
        defaultEnvironment: 'local',
      });
    });

    it('should parse direct environment names', () => {
      expect(parseEnvironmentValue('local')).toBe('local');
      expect(parseEnvironmentValue('production')).toBe('production');
      expect(parseEnvironmentValue('production')).toBe('production');
    });

    it('should parse aliases', () => {
      expect(parseEnvironmentValue('dev')).toBe('local');
      expect(parseEnvironmentValue('prod')).toBe('production');
      expect(parseEnvironmentValue('stg')).toBe('production');
    });

    it('should handle case insensitive input', () => {
      expect(parseEnvironmentValue('LOCAL')).toBe('local');
      expect(parseEnvironmentValue('PROD')).toBe('production');
      expect(parseEnvironmentValue('StG')).toBe('production');
    });

    it('should handle whitespace', () => {
      expect(parseEnvironmentValue('  local  ')).toBe('local');
      expect(parseEnvironmentValue('\tproduction\t')).toBe('production');
    });

    it('should return default for unknown environments', () => {
      expect(parseEnvironmentValue('unknown')).toBe('local');
      expect(console.warn).toHaveBeenCalledWith(
        'Unknown environment: unknown. Using default: local',
      );
    });

    it('should return default for empty string', () => {
      expect(parseEnvironmentValue('')).toBe('local');
      expect(console.warn).toHaveBeenCalledWith('Unknown environment: . Using default: local');
    });
  });

  describe('environment categories', () => {
    beforeEach(() => {
      configureEnvironment({
        environments: ['local', 'dev', 'qa', 'production', 'production'],
        categories: {
          local: 'non-production',
          dev: 'non-production',
          qa: 'non-production',
          staging: 'production',
          production: 'production',
        },
      });
    });

    it('should get correct category for environment', () => {
      expect(getEnvironmentCategory('local')).toBe('non-production');
      expect(getEnvironmentCategory('dev')).toBe('non-production');
      expect(getEnvironmentCategory('qa')).toBe('non-production');
      expect(getEnvironmentCategory('production')).toBe('production'); // Staging simulates production
      expect(getEnvironmentCategory('production')).toBe('production');
    });

    it('should check if environment is in category', () => {
      expect(isEnvironmentInCategory('local', 'non-production')).toBe(true);
      expect(isEnvironmentInCategory('dev', 'non-production')).toBe(true);
      expect(isEnvironmentInCategory('qa', 'non-production')).toBe(true);
      expect(isEnvironmentInCategory('production', 'production')).toBe(true);
      expect(isEnvironmentInCategory('production', 'production')).toBe(true);

      expect(isEnvironmentInCategory('local', 'production')).toBe(false);
      expect(isEnvironmentInCategory('qa', 'production')).toBe(false);
    });

    it('should get environments in category', () => {
      const nonProdEnvs = getEnvironmentsInCategory('non-production');
      expect(nonProdEnvs).toContain('local');
      expect(nonProdEnvs).toContain('dev');
      expect(nonProdEnvs).toContain('qa');

      const prodEnvs = getEnvironmentsInCategory('production');
      expect(prodEnvs).toContain('production');
      expect(prodEnvs).toContain('production');
    });
  });

  describe('environment management', () => {
    beforeEach(() => {
      configureEnvironment({
        environments: ['local', 'production', 'production'],
        categories: {
          local: 'non-production',
          staging: 'production',
          production: 'production',
        },
        defaultEnvironment: 'local',
      });
    });

    it('should get and set environment', () => {
      setEnvironment('production');
      expect(getEnvironment()).toBe('production');
      expect(isEnvironment('production')).toBe(true);

      setEnvironment('production');
      expect(getEnvironment()).toBe('production');
      expect(isEnvironment('production')).toBe(true);
    });

    it('should reset environment', () => {
      setEnvironment('production');
      expect(getEnvironment()).toBe('production');

      resetEnvironment();
      // Should return default when no env vars are set
      expect(getEnvironment()).toBe('local');
    });

    it('should handle aliases in setEnvironment', () => {
      configureEnvironment({
        environments: ['local', 'production'],
        categories: {
          local: 'non-production',
          production: 'production',
        },
        aliases: {
          prod: 'production',
        },
      });

      setEnvironment('prod');
      expect(getEnvironment()).toBe('production');
    });
  });

  describe('determineEnvironment', () => {
    beforeEach(() => {
      configureEnvironment({
        environments: ['local', 'production', 'production'],
        categories: {
          local: 'non-production',
          staging: 'production',
          production: 'production',
        },
        aliases: {
          prod: 'production',
          stg: 'production',
        },
        defaultEnvironment: 'local',
      });
    });

    it('should determine environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      resetEnvironment();
      expect(getEnvironment()).toBe('production');

      process.env.NODE_ENV = 'production';
      resetEnvironment();
      expect(getEnvironment()).toBe('production');
    });

    it('should determine environment from ENVIRONMENT variable', () => {
      process.env.ENVIRONMENT = 'production';
      resetEnvironment();
      expect(getEnvironment()).toBe('production');
    });

    it('should prioritize ENVIRONMENT over NODE_ENV', () => {
      process.env.ENVIRONMENT = 'production';
      process.env.NODE_ENV = 'production';
      resetEnvironment();
      expect(getEnvironment()).toBe('production');
    });

    it('should handle SST_DEV environment', () => {
      process.env.SST_DEV = 'true';
      resetEnvironment();
      expect(getEnvironment()).toBe('local');
    });

    it('should use default when no environment variables are set', () => {
      process.env = {};
      resetEnvironment();
      expect(getEnvironment()).toBe('local');
    });
  });

  describe('helper functions', () => {
    beforeEach(() => {
      configureEnvironment({
        environments: ['local', 'dev', 'qa', 'staging', 'production', 'production'],
        categories: {
          local: 'non-production',
          dev: 'non-production',
          qa: 'non-production',
          staging: 'production',
          production: 'production',
        },
        defaultEnvironment: 'local',
      });
    });

    it('should correctly identify production environments', () => {
      setEnvironment('production');
      expect(isProd()).toBe(true);
      expect(isNonProd()).toBe(false);
      expect(isProduction()).toBe(true);

      setEnvironment('staging');
      expect(isProd()).toBe(true); // Staging simulates production
      expect(isNonProd()).toBe(false);
      expect(isProduction()).toBe(false); // But it's not the actual production environment
    });

    it('should correctly identify non-production environments', () => {
      setEnvironment('local');
      expect(isNonProd()).toBe(true);
      expect(isLocal()).toBe(true);

      setEnvironment('dev');
      expect(isNonProd()).toBe(true);
      expect(isLocal()).toBe(false);

      setEnvironment('qa');
      expect(isNonProd()).toBe(true);
    });

    it('should correctly identify local environment', () => {
      setEnvironment('local');
      expect(isLocal()).toBe(true);

      setEnvironment('dev');
      expect(isLocal()).toBe(false);

      setEnvironment('production');
      expect(isLocal()).toBe(false);
    });
  });

  describe('utility functions', () => {
    beforeEach(() => {
      configureEnvironment({
        environments: ['local', 'dev', 'qa', 'production', 'production'],
        categories: {
          local: 'non-production',
          dev: 'non-production',
          qa: 'non-production',
          staging: 'production',
          production: 'production',
        },
      });
    });

    it('should get all environments', () => {
      const allEnvs = getAllEnvironments();
      expect(allEnvs).toStrictEqual(['local', 'dev', 'qa', 'production', 'production']);
    });

    it('should get all categories', () => {
      const allCategories = getAllCategories();
      expect(allCategories).toStrictEqual(['production', 'non-production']);
    });

    it('should get environments in specific category', () => {
      const nonProdEnvs = getEnvironmentsInCategory('non-production');
      expect(nonProdEnvs).toStrictEqual(['local', 'dev', 'qa']);

      const prodEnvs = getEnvironmentsInCategory('production');
      expect(prodEnvs).toStrictEqual(['production', 'production']);
    });
  });

  describe('real-world scenarios', () => {
    it('should work with startup configuration', () => {
      configureEnvironment({
        environments: ['local', 'production', 'production'],
        categories: {
          local: 'non-production',
          staging: 'production', // Staging simulates production
          production: 'production',
        },
        aliases: {
          dev: 'local',
          prod: 'production',
          stg: 'production',
        },
        defaultEnvironment: 'local',
      });

      // Test aliases
      expect(parseEnvironmentValue('dev')).toBe('local');
      expect(parseEnvironmentValue('prod')).toBe('production');

      // Test categories
      expect(getEnvironmentCategory('local')).toBe('non-production');
      expect(getEnvironmentCategory('production')).toBe('production');
      expect(getEnvironmentCategory('production')).toBe('production');

      // Test helper functions
      setEnvironment('local');
      expect(isNonProd()).toBe(true);
      expect(isProd()).toBe(false);

      setEnvironment('production');
      expect(isNonProd()).toBe(false);
      expect(isProd()).toBe(true); // Staging is production-like

      setEnvironment('production');
      expect(isNonProd()).toBe(false);
      expect(isProd()).toBe(true);
    });

    it('should work with enterprise configuration', () => {
      configureEnvironment({
        environments: ['local', 'dev', 'qa', 'uat', 'preprod', 'production'],
        categories: {
          local: 'non-production',
          dev: 'non-production',
          qa: 'non-production',
          uat: 'non-production',
          preprod: 'production', // Preprod simulates production
          production: 'production',
        },
        aliases: {
          lcl: 'local',
          development: 'dev',
          testing: 'qa',
          staging: 'preprod',
          prod: 'production',
        },
        defaultEnvironment: 'dev',
      });

      // Test complex aliases
      expect(parseEnvironmentValue('development')).toBe('dev');
      expect(parseEnvironmentValue('testing')).toBe('qa');
      expect(parseEnvironmentValue('staging')).toBe('preprod');
      expect(parseEnvironmentValue('prod')).toBe('production');

      // Test categories
      expect(getEnvironmentCategory('qa')).toBe('non-production');
      expect(getEnvironmentCategory('uat')).toBe('non-production');
      expect(getEnvironmentCategory('preprod')).toBe('production');

      // Test helper functions
      setEnvironment('qa');
      expect(isNonProd()).toBe(true);
      expect(isProd()).toBe(false);

      setEnvironment('preprod');
      expect(isNonProd()).toBe(false);
      expect(isProd()).toBe(true); // Preprod is production-like
    });
  });
});
