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

export interface JobAttemptServiceInstance {
  scheduleJobAttempt(jobId: string, scheduledAt?: string): Promise<JobAttemptItem>;
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
    async scheduleJobAttempt(jobId: string, scheduledAt?: string): Promise<JobAttemptItem> {
      const attempt = await jobService.prepareNextJobAttempt(jobId);
      const { data: jobAttempt } = await JobAttempt.create({
        jobId,
        attempt,
        scheduledAt,
      }).go();
      return jobAttempt;
    },

    async rescheduleJobAttempt(
      jobId: string,
      attempt: number,
      scheduledAt: string,
    ): Promise<void> {
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

    async updateJobAttempt(
      jobId: string,
      attempt: number,
      updateFields: JobAttemptUpdateFields,
    ) {
      try {
        await JobAttempt.patch({ jobId, attempt })
          .set(updateFields)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return normalizePaginationResponse(JobAttempt.query.jobAttempts({ jobId }).go(options as any));
    },
  };
}
