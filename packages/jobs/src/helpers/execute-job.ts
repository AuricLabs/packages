import { logger } from '@auriclabs/logger';

import { JobAttemptItem, JobItem } from '../models';
import { JobMessage, JobResponse, jobStatus } from '../types';

import { applyContinuation, JobContinuation } from './continue-job';
import { startJob, StartJobContext } from './start-job';
import { stopJob } from './stop-job';

export type JobExecutorResult = JobResponse | JobContinuation | null | undefined;

export const executeJob = async (
  message: JobMessage,
  executor: (job: StartJobContext) => Promise<JobExecutorResult> | JobExecutorResult,
): Promise<void> => {
  let context: StartJobContext | undefined;
  let response: JobExecutorResult;
  logger.info(message, `processing job ${message.jobId}`);

  try {
    context = await startJob(message);

    if (!context.success) {
      return;
    }

    response = await executor(context);

    if (response instanceof JobContinuation) {
      await applyContinuation(context, response);
      return;
    }

    await stopJob(context, response);
  } catch (error) {
    if (context) {
      await stopJob(context, { success: false, error }).catch((err: unknown) => {
        logger.error({ err }, 'failed to update job');
        return undefined;
      });
    } else {
      logger.error(
        { err: error },
        'failed to process job, but job was not started. Will send back to retry.',
      );
    }

    throw new JobExecutionError(
      error,
      context?.job,
      context?.jobAttempt,
      response instanceof JobContinuation ? undefined : response,
    );
  }
};

export class JobExecutionError extends Error {
  get started() {
    return this.job?.status === jobStatus.running;
  }
  get completed() {
    return this.job?.status === jobStatus.completed;
  }
  constructor(
    public readonly originalError: unknown,
    public readonly job?: JobItem,
    public readonly jobAttempt?: JobAttemptItem,
    public readonly response?: JobResponse | null,
  ) {
    super(originalError instanceof Error ? originalError.message : String(originalError));
    this.name = 'JobExecutionError';
  }
}
