import { Logger, logger as defaultLogger } from '@auriclabs/logger';
import { merge } from 'lodash-es';
import pRetry, { FailedAttemptError, Options } from 'p-retry';

export let defaultRetryConfig: Options = {
  retries: 5,
  factor: 1.5,
  minTimeout: 1000,
  maxTimeout: 10000,
};

export interface RetryOptions extends Omit<Options, 'logger'> {
  logger?: Logger;
  failureLogLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export const setDefaultRetryConfig = (config: Options) => {
  defaultRetryConfig = config;
};

export const retry = <T>(fn: () => Promise<T> | T, options?: RetryOptions): Promise<T> => {
  const logger = options?.logger ?? defaultLogger;
  return pRetry(
    fn,
    merge(
      {}, // default options
      defaultRetryConfig,
      options, // user options
      {
        async onFailedAttempt(error: FailedAttemptError) {
          logger[options?.failureLogLevel ?? 'warn'](
            { err: error, attemptNumber: error.attemptNumber },
            `Retry attempt failed. ${error.message}. Retrying...`,
          );
          await options?.onFailedAttempt?.(error);
        },
      } satisfies Options, // override options
    ),
  );
};
