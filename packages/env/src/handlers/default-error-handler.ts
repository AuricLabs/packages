import { ZodError } from 'zod';

/**
 * Default error handler for parseEnv.
 * Uses console.error for consistent cross-platform error logging.
 */
export const defaultErrorHandler = (error: unknown) => {
  if (error instanceof ZodError) {
    console.error('Invalid environment variables:');
    error.issues.forEach((issue) => {
      console.error(`\t - ${issue.path.join('.')}: ${issue.message}`);
    });
  } else {
    console.error(`Failed to parse environment variables. ${String(error)}`);
  }
};
