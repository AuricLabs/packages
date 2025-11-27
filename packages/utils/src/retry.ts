import { logger } from '@auriclabs/logger';
import { merge } from 'lodash-es';
import pRetry, { FailedAttemptError, Options } from 'p-retry';

export let defaultRetryConfig: Options = {
  retries: 5,
  factor: 1.5,
  minTimeout: 1000,
  maxTimeout: 10000,
};

export const setDefaultRetryConfig = (config: Options) => {
  defaultRetryConfig = config;
};

export const retry = <T>(fn: () => Promise<T> | T, options?: Options): Promise<T> => {
  return pRetry(
    fn,
    merge(
      {}, // default options
      defaultRetryConfig,
      options, // user options
      {
        async onFailedAttempt(error: FailedAttemptError) {
          logger.error({ err: error, attemptNumber: error.attemptNumber }, 'Error retrying');
          await options?.onFailedAttempt?.(error);
        },
      } satisfies Options, // override options
    ),
  );
};
