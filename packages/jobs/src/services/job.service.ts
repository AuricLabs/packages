import { PaginationResponse } from '@auriclabs/pagination';
import { ElectroError } from 'electrodb';
import { NotFoundError } from 'http-errors-enhanced';

import { JobErrorCodes } from '../errors';
import { JobEntity, JobItem, JobCreateFields, JobUpdateFields } from '../models';
import { JobStatus, jobStatus } from '../types';

export interface ListJobsOptions {
  limit?: number;
}

export type JobSummary = Record<JobStatus, number>;

export interface JobServiceInstance {
  getJob(jobId: string): Promise<JobItem>;
  listJobsByStatus(
    status: JobStatus,
    options?: ListJobsOptions,
  ): Promise<PaginationResponse<JobItem>>;
  listJobs(options?: Pick<ListJobsOptions, 'limit'>): Promise<JobItem[]>;
  getJobSummary(): Promise<JobSummary>;
  updateJobStatus(jobId: string, status: JobStatus, expectedStatus: JobStatus): Promise<boolean>;
  updateJob(
    jobId: string,
    updateFields: JobUpdateFields,
    requiredStatus?: JobStatus,
  ): Promise<void>;
  createJob(definition: JobCreateFields): Promise<JobItem>;
  prepareNextJobAttempt(jobId: string): Promise<number>;
  prepareContinuationAttempt(jobId: string): Promise<number>;
}

export function createJobService(Job: JobEntity): JobServiceInstance {
  return {
    async getJob(jobId: string): Promise<JobItem> {
      const { data: job } = await Job.get({ id: jobId }).go({
        consistent: true,
      });

      if (!job) {
        throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
          jobId,
        });
      }

      return job as JobItem;
    },

    // The gsi1 SK is the job id (a uuid), so DynamoDB returns partitions in
    // arbitrary order — both list methods read the full partition(s) and sort
    // by createdAt in memory. Same cost profile as getJobSummary; fine for
    // dashboard scale, not for hot paths on large tables.
    async listJobsByStatus(
      status: JobStatus,
      options?: ListJobsOptions,
    ): Promise<PaginationResponse<JobItem>> {
      const { data } = await Job.query.jobStatuses({ status }).go({ pages: 'all' });
      const jobs = data
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options?.limit ?? 100);
      return { data: jobs, cursor: null, hasMore: false };
    },

    async listJobs(options?: Pick<ListJobsOptions, 'limit'>): Promise<JobItem[]> {
      const limit = options?.limit ?? 100;
      const results = await Promise.all(
        Object.values(jobStatus).map((status) =>
          Job.query.jobStatuses({ status }).go({ pages: 'all' }),
        ),
      );
      return results
        .flatMap((result) => result.data)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async getJobSummary(): Promise<JobSummary> {
      const entries = await Promise.all(
        Object.values(jobStatus).map(async (status) => {
          const { data } = await Job.query
            .jobStatuses({ status })
            .go({ pages: 'all', attributes: ['id'] });
          return [status, data.length] as const;
        }),
      );
      return Object.fromEntries(entries) as JobSummary;
    },

    async updateJobStatus(
      jobId: string,
      status: JobStatus,
      expectedStatus: JobStatus,
    ): Promise<boolean> {
      try {
        await Job.patch({ id: jobId })
          .set({ status })
          .where((attr, op) => op.eq<JobStatus, JobStatus>(attr.status, expectedStatus))
          .go();
        return true;
      } catch (error) {
        if (error instanceof ElectroError) {
          return false;
        }
        throw error;
      }
    },

    async updateJob(jobId: string, updateFields: JobUpdateFields, requiredStatus?: JobStatus) {
      let action = Job.patch({ id: jobId }).set(updateFields);

      if (requiredStatus) {
        action = action.where((attr, op) =>
          op.eq<JobStatus, JobStatus>(attr.status, requiredStatus),
        );
      }

      try {
        await action.go();
      } catch (error) {
        if (error instanceof ElectroError) {
          throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
            jobId,
          });
        }
        throw error;
      }
    },

    async createJob(definition: JobCreateFields): Promise<JobItem> {
      const { data: job } = await Job.create(definition).go();
      return job;
    },

    async prepareContinuationAttempt(jobId: string): Promise<number> {
      try {
        const { data: job } = await Job.patch({ id: jobId })
          .set({ status: jobStatus.pending })
          .add({ totalAttempts: 1 })
          // running -> pending directly, so status pollers never see a false 'completed'
          .where((attr, op) => op.eq<JobStatus, JobStatus>(attr.status, jobStatus.running))
          .go({
            response: 'updated_new',
          });
        return job.totalAttempts ?? 1;
      } catch (error) {
        if (error instanceof ElectroError) {
          throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
            jobId,
          });
        }
        throw error;
      }
    },

    async prepareNextJobAttempt(jobId: string): Promise<number> {
      try {
        const { data: job } = await Job.patch({ id: jobId })
          .set({ status: jobStatus.pending })
          .add({ totalAttempts: 1 })
          .where((attr, op) => {
            // retryable from pending/completed/failed; never while running or after cancel
            return `${op.ne<JobStatus, JobStatus>(
              attr.status,
              jobStatus.running,
            )} AND ${op.ne<JobStatus, JobStatus>(attr.status, jobStatus.cancelled)}`;
          })
          .go({
            response: 'updated_new',
          });
        return job.totalAttempts ?? 1;
      } catch (error) {
        if (error instanceof ElectroError) {
          throw new NotFoundError(JobErrorCodes.JOB_NOT_FOUND, {
            jobId,
          });
        }
        throw error;
      }
    },
  };
}
