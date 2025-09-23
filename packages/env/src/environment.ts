/**
 * The supported environment values.
 */
export const environment = {
  production: 'production',
  staging: 'staging',
  development: 'development',
  local: 'local',
} as const;

export const environments = Object.values(environment);

export type Environment = (typeof environments)[number];

/**
 * Parse the environment value from the environment variable.
 * @param envValue The environment value to parse.
 * @returns The parsed environment value.
 */
export const parseEnvironmentValue = (envValue: string): Environment => {
  const env = envValue.toLowerCase().trim();
  switch (env) {
    case 'prd':
    case 'prod':
    case 'production':
      return environment.production;
    case 'staging':
    case 'stage':
    case 'stg':
      return environment.staging;
    case 'dev':
    case 'develop':
    case 'development':
      return environment.development;
    case 'lcl':
    case 'local':
      return environment.local;
    default:
      return environment.development;
  }
};

let _cachedEnvironment = determineEnvironment();

export function getEnvironment(): Environment {
  return _cachedEnvironment;
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function setEnvironment(environment: Environment | string): void {
  _cachedEnvironment = parseEnvironmentValue(environment);
}

export function isEnvironment(environment: Environment): boolean {
  return _cachedEnvironment === environment;
}

export function resetEnvironment(): void {
  _cachedEnvironment = determineEnvironment();
}

/**
 * Get the environment value from the environment variable.
 * @returns The environment value.
 */
export function determineEnvironment(): Environment {
  // Check if we're in a Node.js environment
  const isNode = typeof process !== 'undefined' && process.env;

  if (isNode) {
    // Node.js environment
    if (process.env.SST_DEV === 'true') {
      return environment.local;
    }

    const envValue = process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? '';
    return parseEnvironmentValue(envValue);
  } else {
    // Browser environment - check for build-time environment variables
    // These would typically be injected by build tools like Vite, Webpack, etc.
    let envValue = '';

    // Check for Vite environment variables
    if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
      const meta = import.meta as { env?: { MODE?: string } };
      envValue = meta.env?.MODE ?? '';
    }

    // Check for Webpack DefinePlugin variables (these would be replaced at build time)
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

// Variable that represents production like environments
export const isProd = (): boolean =>
  isEnvironment(environment.production) || isEnvironment(environment.staging);

// Variable that represents non-production environments
export const isNonProd = (): boolean => !isProd();

// Variable that represents local environment
export const isLocal = (): boolean => isEnvironment(environment.local);
