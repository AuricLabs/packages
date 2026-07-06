import { logger } from '@auriclabs/logger';

import { getJobService, getJobAttemptService, getJobQueueService } from '../init';
import { JobAttemptItem, JobItem } from '../models';
import { JobMessage, jobStatus } from '../types';

import { OutputBuffer, OutputLevel } from './output-buffer';

export type JobLogFn = (message: unknown, ...rest: unknown[]) => void;

export interface JobLogger {
  info: JobLogFn;
  warn: JobLogFn;
  error: JobLogFn;
  debug: JobLogFn;
}

export interface StartJobContext {
  job: JobItem;
  jobAttempt: JobAttemptItem;
  success: boolean;
  /**
   * Capture a log line onto the attempt row (visible in the dashboard's
   * attempt detail). Byte-capped — oldest lines drop first past the cap.
   * Only in-process executors can capture; jobs run through the lambda
   * executor log to their own target Lambda's CloudWatch instead.
   */
  log: JobLogFn;
  logger: JobLogger;
  /** @internal buffer behind log/logger — serialized by stopJob/continuation */
  outputBuffer: OutputBuffer;
}

/**
 * Lower than migrations' 200KB default: job attempt rows also carry
 * unbounded `response` and `state`, and the whole row must stay under
 * DynamoDB's 400KB item limit.
 */
const OUTPUT_MAX_BYTES = 64 * 1024;

function createLogContext(): Pick<StartJobContext, 'log' | 'logger' | 'outputBuffer'> {
  const outputBuffer = new OutputBuffer(OUTPUT_MAX_BYTES);
  const append =
    (level: OutputLevel): JobLogFn =>
    (message, ...rest) => {
      outputBuffer.append(level, message, ...rest);
    };
  return {
    outputBuffer,
    log: append('info'),
    logger: {
      info: append('info'),
      warn: append('warn'),
      error: append('error'),
      debug: append('debug'),
    },
  };
}

export const startJob = async ({ jobId, attempt, queue }: JobMessage): Promise<StartJobContext> => {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();
  const jobQueueService = getJobQueueService();

  const jobAttempt = await jobAttemptService.getJobAttempt(jobId, attempt);
  const job = await jobService.getJob(jobId);

  logger.debug({ jobAttempt, job }, 'Received job attempt');
  if (jobAttempt.scheduledAt && new Date(jobAttempt.scheduledAt).getTime() > Date.now()) {
    logger.info({ jobId }, 'job is scheduled, re-adding to queue');
    await jobQueueService.addToQueue(queue, jobId, attempt, jobAttempt.scheduledAt);
    return {
      job,
      jobAttempt,
      success: false,
      ...createLogContext(),
    };
  }

  const startedAt = await jobAttemptService.markJobAttemptAsRunning(jobId, attempt);

  if (!startedAt) {
    logger.info({ jobId }, 'job is not pending, skipping');
    return {
      job,
      jobAttempt,
      success: false,
      ...createLogContext(),
    };
  }

  Object.assign(job, { status: jobStatus.running });
  Object.assign(jobAttempt, { startedAt, status: jobStatus.running });

  return {
    job,
    jobAttempt,
    success: true,
    ...createLogContext(),
  };
};
