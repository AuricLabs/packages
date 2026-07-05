import { PaginationResponse, normalizePaginationResponse } from '@auriclabs/pagination';
import { ElectroError } from 'electrodb';
import { NotFoundError } from 'http-errors-enhanced';

import { JobErrorCodes } from '../errors';
import { JobAttemptEntity, JobAttemptItem, JobAttemptUpdateFields } from '../models';
import { jobStatus, JobStatus } from '../types';

import { JobServiceInstance } from './job.service';

export interface QueryOptions {
  cursor?: string | null;
  limit?: number;
  count?: number;
  pages?: number | 'all';
  order?: 'asc' | 'desc';
  consistent?: boolean;
}

export interface ContinuationFields {
  duration: number;
  completedAt: string;
  response?: unknown;
}

export interface ContinuationNext {
  state: unknown;
  scheduledAt?: string;
}

export interface JobAttemptServiceInstance {
  scheduleJobAttempt(jobId: string, scheduledAt?: string, state?: unknown): Promise<JobAttemptItem>;
  continueJobAttempt(
    jobId: string,
    attempt: number,
    fields: ContinuationFields,
    next: ContinuationNext,
  ): Promise<JobAttemptItem>;
  rescheduleJobAttempt(jobId: string, attempt: number, scheduledAt: string): Promise<void>;
  getJobAttempt(jobId: string, attempt: number): Promise<JobAttemptItem>;
  markJobAttemptAsRunning(jobId: string, attempt: number): Promise<false | string>;
  updateJobAttempt(
    jobId: string,
    attempt: number,
    updateFields: JobAttemptUpdateFields,
  ): Promise<void>;
  getAllJobAttempts(
    jobId: string,
    options?: QueryOptions,
  ): Promise<PaginationResponse<JobAttemptItem>>;
}

export function createJobAttemptService(
  JobAttempt: JobAttemptEntity,
  jobService: JobServiceInstance,
): JobAttemptServiceInstance {
  return {
    async scheduleJobAttempt(
      jobId: string,
      scheduledAt?: string,
      state?: unknown,
    ): Promise<JobAttemptItem> {
      const attempt = await jobService.prepareNextJobAttempt(jobId);
      const { data: jobAttempt } = await JobAttempt.create({
        jobId,
        attempt,
        scheduledAt,
        state,
      }).go();
      return jobAttempt;
    },

    async continueJobAttempt(
      jobId: string,
      attempt: number,
      fields: ContinuationFields,
      next: ContinuationNext,
    ): Promise<JobAttemptItem> {
      try {
        // complete the current attempt without touching job status — the job
        // stays running until prepareContinuationAttempt flips it to pending
        await JobAttempt.patch({ jobId, attempt })
          .set({
            status: jobStatus.completed,
            duration: fields.duration,
            completedAt: fields.completedAt,
            response: fields.response,
          })
          .remove(['error'])
          .where((attr, op) => op.eq<JobStatus, JobStatus>(attr.status, jobStatus.running))
          .go();
      } catch (error) {
        if (error instanceof ElectroError) {
          throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
            jobId,
          });
        }
        throw error;
      }

      try {
        const nextAttempt = await jobService.prepareContinuationAttempt(jobId);
        const { data: jobAttempt } = await JobAttempt.create({
          jobId,
          attempt: nextAttempt,
          scheduledAt: next.scheduledAt,
          state: next.state,
        }).go();
        return jobAttempt;
      } catch (error) {
        // compensate: revert the attempt to running so the caller's standard
        // failure path (stopJob) can mark it failed instead of wedging the job
        await JobAttempt.patch({ jobId, attempt })
          .set({ status: jobStatus.running })
          .where((attr, op) => op.eq<JobStatus, JobStatus>(attr.status, jobStatus.completed))
          .go()
          .catch(() => undefined);
        throw error;
      }
    },

    async rescheduleJobAttempt(jobId: string, attempt: number, scheduledAt: string): Promise<void> {
      await JobAttempt.patch({ jobId, attempt }).set({ scheduledAt }).go();
    },

    async getJobAttempt(jobId: string, attempt: number): Promise<JobAttemptItem> {
      const { data: jobAttempt } = await JobAttempt.get({ jobId, attempt }).go({
        consistent: true,
      });

      if (!jobAttempt) {
        throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
          jobId,
        });
      }

      return jobAttempt;
    },

    async markJobAttemptAsRunning(jobId: string, attempt: number): Promise<false | string> {
      if (!(await jobService.updateJobStatus(jobId, jobStatus.running, jobStatus.pending))) {
        return false;
      }

      try {
        const startedAt = new Date().toISOString();
        await JobAttempt.patch({ jobId, attempt })
          .set({ status: jobStatus.running, startedAt })
          .where((attr, op) => op.eq<JobStatus, JobStatus>(attr.status, jobStatus.pending))
          .go();
        return startedAt;
      } catch (error) {
        if (error instanceof ElectroError) {
          await jobService.updateJobStatus(jobId, jobStatus.pending, jobStatus.running);
          return false;
        }
        throw error;
      }
    },

    async updateJobAttempt(jobId: string, attempt: number, updateFields: JobAttemptUpdateFields) {
      try {
        let action = JobAttempt.patch({ jobId, attempt }).set(updateFields);

        if (updateFields.status === jobStatus.completed) {
          action = action.remove(['error']);
        }

        await action
          .where((attr, op) => op.eq<JobStatus, JobStatus>(attr.status, jobStatus.running))
          .go();

        if (updateFields.status) {
          await jobService.updateJobStatus(jobId, updateFields.status, jobStatus.running);
        }
      } catch (error) {
        if (error instanceof ElectroError) {
          throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
            jobId,
          });
        }
        throw error;
      }
    },

    async getAllJobAttempts(
      jobId: string,
      options?: QueryOptions,
    ): Promise<PaginationResponse<JobAttemptItem>> {
      return normalizePaginationResponse(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        JobAttempt.query.jobAttempts({ jobId }).go(options as any),
      );
    },
  };
}
