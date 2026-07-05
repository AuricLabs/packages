import { executeJob } from '../helpers';
import { getJobService, getLambdaExecutorService } from '../init';

import { createSqsJobConsumer } from './sqs-job-consumer';

export function createLambdaExecutorHandler() {
  return createSqsJobConsumer(async (message) => {
    const jobService = getJobService();
    const lambdaExecutorService = getLambdaExecutorService();

    const job = await jobService.getJob(message.jobId);
    await executeJob(message, () =>
      lambdaExecutorService.trigger(message.jobId, job.fn, job.payload),
    );
  });
}
