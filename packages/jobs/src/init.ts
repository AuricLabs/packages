import { createJobModel, JobEntity } from './models/job.model';
import { createJobAttemptModel, JobAttemptEntity } from './models/job-attempt.model';
import { createJobService, JobServiceInstance } from './services/job.service';
import { createJobAttemptService, JobAttemptServiceInstance } from './services/job-attempt.service';
import { createJobQueueService, JobQueueServiceInstance } from './services/job-queue.service';
import {
  createLambdaExecutorService,
  LambdaExecutorServiceInstance,
} from './services/lambda-executor.service';

let _Job: JobEntity | undefined;
let _JobAttempt: JobAttemptEntity | undefined;
let _jobService: JobServiceInstance | undefined;
let _jobAttemptService: JobAttemptServiceInstance | undefined;
let _jobQueueService: JobQueueServiceInstance | undefined;
let _lambdaExecutorService: LambdaExecutorServiceInstance | undefined;

export function initJobs(config: { tableName: string }): void {
  _Job = createJobModel(config.tableName);
  _JobAttempt = createJobAttemptModel(config.tableName);
  _jobService = createJobService(_Job);
  _jobAttemptService = createJobAttemptService(_JobAttempt, _jobService);
  _jobQueueService = createJobQueueService();
  _lambdaExecutorService = createLambdaExecutorService();
}

function assertInitialized(): void {
  if (!_Job) {
    throw new Error('Call initJobs() before using jobs');
  }
}

export function getJobModel(): JobEntity {
  assertInitialized();
  return _Job!;
}

export function getJobAttemptModel(): JobAttemptEntity {
  assertInitialized();
  return _JobAttempt!;
}

export function getJobService(): JobServiceInstance {
  assertInitialized();
  return _jobService!;
}

export function getJobAttemptService(): JobAttemptServiceInstance {
  assertInitialized();
  return _jobAttemptService!;
}

export function getJobQueueService(): JobQueueServiceInstance {
  assertInitialized();
  return _jobQueueService!;
}

export function getLambdaExecutorService(): LambdaExecutorServiceInstance {
  assertInitialized();
  return _lambdaExecutorService!;
}
