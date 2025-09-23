import { logger } from '@auriclabs/logger';
import { merge } from 'lodash';
import pRetry, { FailedAttemptError, Options } from 'p-retry';

export const retry = <T>(fn: () => Promise<T>, options?: Options): Promise<T> => {
  return pRetry(
    fn,
    merge(
      {
        retries: 5,
        factor: 1.5,
        minTimeout: 1000,
        maxTimeout: 10000,
      } satisfies Options, // default options
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
