import { ElectroError } from 'electrodb';
import { NotFoundError } from 'http-errors-enhanced';

import { JobErrorCodes } from '../errors';
import { JobEntity, JobItem, JobCreateFields, JobUpdateFields } from '../models';
import { JobStatus, jobStatus } from '../types';

export interface JobServiceInstance {
  getJob(jobId: string): Promise<JobItem>;
  updateJobStatus(jobId: string, status: JobStatus, expectedStatus: JobStatus): Promise<boolean>;
  updateJob(
    jobId: string,
    updateFields: JobUpdateFields,
    requiredStatus?: JobStatus,
  ): Promise<void>;
  createJob(definition: JobCreateFields): Promise<JobItem>;
  prepareNextJobAttempt(jobId: string): Promise<number>;
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

    async prepareNextJobAttempt(jobId: string): Promise<number> {
      try {
        const { data: job } = await Job.patch({ id: jobId })
          .set({ status: jobStatus.pending })
          .add({ totalAttempts: 1 })
          .where((attr, op) => {
            return `${op.eq<JobStatus, JobStatus>(
              attr.status,
              jobStatus.completed,
            )} OR ${op.ne<JobStatus, JobStatus>(attr.status, jobStatus.failed)}`;
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
