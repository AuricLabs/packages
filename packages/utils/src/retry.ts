import { Logger, logger as defaultLogger } from '@auriclabs/logger';
import { merge } from 'lodash-es';
import pRetry, { FailedAttemptError, Options } from 'p-retry';

export let defaultRetryConfig: Options = {
  retries: 5,
  factor: 1.5,
  minTimeout: 1000,
  maxTimeout: 10000,
};

export type RetryOptions = Exclude<Options, number[]> & {
  logger?: Logger;
  logFailure?: boolean;
  failureLogLevel?: 'debug' | 'info' | 'warn' | 'error' | 'trace';
};

export const setDefaultRetryConfig = (config: Options) => {
  defaultRetryConfig = config;
};

export const retry = <T>(
  fn: () => Promise<T> | T,
  {
    logger = defaultLogger,
    failureLogLevel = 'warn',
    logFailure = true,
    ...options
  }: RetryOptions = {},
): Promise<T> => {
  return pRetry(
    fn,
    merge(
      {}, // default options
      defaultRetryConfig,
      options, // user options
      {
        async onFailedAttempt(error: FailedAttemptError) {
          if (logFailure) {
            logger[failureLogLevel](
              { err: error, attemptNumber: error.attemptNumber },
              `Retry attempt failed. ${error.message}. Retrying...`,
            );
          }
          await options.onFailedAttempt?.(error);
        },
      } satisfies Options, // override options
    ),
  );
};
