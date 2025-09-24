/**
 * Environment categories - simplified to just Prod vs NonProd
 */
export type EnvironmentCategory = 'production' | 'non-production';

/**
 * Configuration for environment mapping
 */
export interface EnvironmentConfig {
  /** List of valid environment names for this application */
  environments: readonly string[];
  /** Mapping of environment names to categories */
  categories: Record<string, EnvironmentCategory>;
  /** Aliases for environment names (e.g., 'dev' -> 'development') */
  aliases?: Record<string, string>;
  /** Default environment when none is specified */
  defaultEnvironment?: string;
}

/**
 * Default environment configuration - simplified to Prod vs NonProd
 */
export const defaultEnvironmentConfig: EnvironmentConfig = {
  environments: [
    'local',
    'development',
    'testing',
    'qa',
    'uat',
    'staging',
    'preprod',
    'production',
    'sandbox',
    'demo',
    'integration',
    'performance',
    'load',
    'stress',
    'acceptance',
    'review',
    'preview',
    'canary',
    'blue',
    'green',
  ] as const,
  categories: {
    // Development and testing environments
    local: 'non-production',
    development: 'non-production',
    testing: 'non-production',
    qa: 'non-production',
    uat: 'non-production',
    acceptance: 'non-production',
    integration: 'non-production',
    performance: 'non-production',
    load: 'non-production',
    stress: 'non-production',

    // Production-like environments (staging simulates prod)
    staging: 'production',
    preprod: 'production',
    sandbox: 'production',
    demo: 'production',
    review: 'production',
    preview: 'production',
    canary: 'production',
    blue: 'production',
    green: 'production',
    production: 'production',
  },
  aliases: {
    // Production aliases
    prd: 'production',
    prod: 'production',
    // Staging aliases
    stage: 'staging',
    stg: 'staging',
    // Development aliases
    dev: 'development',
    develop: 'development',
    // Local aliases
    lcl: 'local',
    // UAT aliases
    'user-acceptance-testing': 'uat',
    'user-acceptance': 'uat',
    // Testing aliases
    test: 'testing',
    tst: 'testing',
    // QA aliases
    'quality-assurance': 'qa',
    quality: 'qa',
    // Preprod aliases
    'pre-prod': 'preprod',
    'pre-production': 'preprod',
    // Sandbox aliases
    sbx: 'sandbox',
    playground: 'sandbox',
    // Demo aliases
    demonstration: 'demo',
    // Integration aliases
    int: 'integration',
    integ: 'integration',
    // Performance aliases
    perf: 'performance',
    'perf-test': 'performance',
    // Load aliases
    'load-test': 'load',
    loadtest: 'load',
    // Stress aliases
    'stress-test': 'stress',
    stresstest: 'stress',
    // Acceptance aliases
    acc: 'acceptance',
    accept: 'acceptance',
    // Review aliases
    rev: 'review',
    // Preview aliases
    prev: 'preview',
    // Canary aliases
    can: 'canary',
  },
  defaultEnvironment: 'development',
};

/**
 * Global environment configuration
 */
let _environmentConfig: EnvironmentConfig = defaultEnvironmentConfig;

/**
 * Configure the environment system for your application
 * @param config Environment configuration
 */
export function configureEnvironment(config: Partial<EnvironmentConfig>): void {
  _environmentConfig = {
    ...defaultEnvironmentConfig,
    ...config,
    categories: {
      ...defaultEnvironmentConfig.categories,
      ...config.categories,
    },
    aliases: {
      ...defaultEnvironmentConfig.aliases,
      ...config.aliases,
    },
  };
  resetEnvironment();
}

/**
 * Get the current environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return _environmentConfig;
}

/**
 * Parse the environment value from the environment variable
 * @param envValue The environment value to parse
 * @returns The parsed environment value
 */
export function parseEnvironmentValue(envValue: string): string {
  const env = envValue.toLowerCase().trim();

  // Check if it's a direct environment name
  if (_environmentConfig.environments.includes(env)) {
    return env;
  }

  // Check if it's an alias
  const aliasedEnv = _environmentConfig.aliases?.[env];
  if (aliasedEnv && _environmentConfig.environments.includes(aliasedEnv)) {
    return aliasedEnv;
  }

  // Return default environment for unknown values
  console.warn(
    `Unknown environment: ${env}. Using default: ${_environmentConfig.defaultEnvironment ?? 'development'}`,
  );
  return _environmentConfig.defaultEnvironment ?? 'development';
}

/**
 * Get the category for an environment
 * @param env Environment name
 * @returns Environment category
 */
export function getEnvironmentCategory(env: string): EnvironmentCategory {
  return _environmentConfig.categories[env] ?? 'development';
}

/**
 * Check if an environment is in a specific category
 * @param env Environment name
 * @param category Environment category
 * @returns True if environment is in the category
 */
export function isEnvironmentInCategory(env: string, category: EnvironmentCategory): boolean {
  return getEnvironmentCategory(env) === category;
}

let _cachedEnvironment = determineEnvironment();

/**
 * Get the current environment
 */
export function getEnvironment(): string {
  return _cachedEnvironment;
}

/**
 * Set the current environment
 * @param environment Environment name or alias
 */
export function setEnvironment(environment: string): void {
  _cachedEnvironment = parseEnvironmentValue(environment);
}

/**
 * Check if the current environment matches the given environment
 * @param environment Environment name to check
 * @returns True if current environment matches
 */
export function isEnvironment(environment: string): boolean {
  return _cachedEnvironment === parseEnvironmentValue(environment);
}

/**
 * Reset the environment to the determined value
 */
export function resetEnvironment(): void {
  _cachedEnvironment = determineEnvironment();
}

/**
 * Determine the environment from environment variables
 * @returns The determined environment
 */
export function determineEnvironment(): string {
  // Check if we're in a Node.js environment
  const isNode = typeof process !== 'undefined' && process.env;

  if (isNode) {
    // Node.js environment
    if (process.env.SST_DEV === 'true') {
      return parseEnvironmentValue('local');
    }

    const envValue = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? '';
    return parseEnvironmentValue(envValue);
  } else {
    // Browser environment - check for build-time environment variables
    let envValue = '';

    // Check for Vite environment variables
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - this is required for tests
    if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - this is required for tests
      const meta = import.meta as { env?: { MODE?: string } };
      envValue = meta.env?.MODE ?? '';
    }

    // Check for Webpack DefinePlugin variables
    // @ts-expect-error - These might not exist in all environments
    if (!envValue && typeof ENVIRONMENT !== 'undefined') {
      // @ts-expect-error - This is a build-time variable
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      envValue = ENVIRONMENT;
    }

    // @ts-expect-error - These might not exist in all environments
    if (!envValue && typeof NODE_ENV !== 'undefined') {
      // @ts-expect-error - This is a build-time variable
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      envValue = NODE_ENV;
    }

    return parseEnvironmentValue(envValue);
  }
}

// Helper functions - simplified to just Prod vs NonProd
export const isProd = (): boolean => isEnvironmentInCategory(_cachedEnvironment, 'production');
export const isNonProd = (): boolean =>
  isEnvironmentInCategory(_cachedEnvironment, 'non-production');

// Convenience functions for specific environments
export const isLocal = (): boolean => _cachedEnvironment === parseEnvironmentValue('local');
export const isProduction = (): boolean =>
  _cachedEnvironment === parseEnvironmentValue('production');

// Utility functions for environment management
export const getEnvironmentsInCategory = (category: EnvironmentCategory): string[] => {
  return _environmentConfig.environments.filter(
    (env) => _environmentConfig.categories[env] === category,
  );
};

export const getAllEnvironments = (): readonly string[] => {
  return _environmentConfig.environments;
};

export const getAllCategories = (): EnvironmentCategory[] => {
  return ['production', 'non-production'];
};
