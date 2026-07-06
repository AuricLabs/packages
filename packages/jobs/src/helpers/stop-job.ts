import { logger } from '@auriclabs/logger';

import { getJobAttemptService } from '../init';
import { JobAttemptItem, JobItem } from '../models';
import { JobResponse, jobStatus } from '../types';

import { StartJobContext } from './start-job';

export interface StopJobContext {
  job: JobItem;
  jobAttempt: JobAttemptItem;
  success: boolean;
}

export const stopJob = async (
  {
    job,
    jobAttempt,
    outputBuffer,
  }: Pick<StartJobContext, 'job' | 'jobAttempt'> & Partial<Pick<StartJobContext, 'outputBuffer'>>,
  response: JobResponse | undefined | null,
): Promise<StopJobContext> => {
  const jobAttemptService = getJobAttemptService();
  const completedAt = new Date().toISOString();

  if (!jobAttempt.startedAt) {
    throw new Error('Job attempt has no startedAt');
  }

  const success = response?.success ?? !response?.error;
  const duration = new Date(completedAt).getTime() - new Date(jobAttempt.startedAt).getTime();
  const output = outputBuffer && !outputBuffer.isEmpty ? outputBuffer.serialize() : undefined;
  const outputTruncated = outputBuffer?.truncated ? true : undefined;

  logger.info(
    { jobId: job.id, response, attempt: jobAttempt.attempt },
    `job ${job.id} completed as ${success ? 'success' : 'failed'} in ${duration}ms`,
  );

  const updateFields = success
    ? {
        status: jobStatus.completed,
        duration,
        response: response?.data,
        completedAt,
        output,
        outputTruncated,
      }
    : {
        status: jobStatus.failed,
        error: response?.error instanceof Error ? response.error.stack : String(response?.error),
        response: response?.data,
        failedAt: completedAt,
        duration,
        output,
        outputTruncated,
      };

  try {
    try {
      await jobAttemptService.updateJobAttempt(job.id, jobAttempt.attempt, updateFields);
    } catch (error) {
      if (output === undefined) {
        throw error;
      }
      // The row may have blown DynamoDB's item limit (output + response +
      // state share the 400KB cap). Losing the logs beats wedging the
      // attempt in `running` forever — retry once without them.
      logger.warn(
        { err: error, jobId: job.id, attempt: jobAttempt.attempt },
        'failed to persist attempt with captured output — retrying without output',
      );
      await jobAttemptService.updateJobAttempt(job.id, jobAttempt.attempt, {
        ...updateFields,
        output: undefined,
        outputTruncated: true,
      });
    }
  } catch (error) {
    logger.error({ error }, 'failed to update job attempt');
    return {
      job,
      jobAttempt,
      success: false,
    };
  }

  Object.assign(job, { status: success ? jobStatus.completed : jobStatus.failed });
  Object.assign(jobAttempt, {
    status: success ? jobStatus.completed : jobStatus.failed,
    completedAt,
    duration,
    response: response?.data,
    error:
      response?.error instanceof Error
        ? response.error.stack
        : success
          ? undefined
          : String(response?.error),
  });

  return {
    job,
    jobAttempt,
    success: true,
  };
};
