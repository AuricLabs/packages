import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

import { getJobService, getJobQueueService } from '../init';
import { JobAttemptItem } from '../models';

export function createJobTableStreamHandler() {
  return async (event: DynamoDBStreamEvent): Promise<void> => {
    const jobService = getJobService();
    const jobQueueService = getJobQueueService();

    for (const record of event.Records) {
      switch (record.eventName) {
        case 'INSERT': {
          const data = record.dynamodb?.NewImage;
          const jobAttempt = unmarshall(data as Record<string, AttributeValue>) as JobAttemptItem;
          const job = await jobService.getJob(jobAttempt.jobId);

          await jobQueueService.addToQueue(
            job.queue,
            job.id,
            jobAttempt.attempt,
            jobAttempt.scheduledAt,
          );
          break;
        }
        case 'MODIFY': {
          const prevJobAttempt = unmarshall(
            record.dynamodb?.OldImage as Record<string, AttributeValue>,
          ) as JobAttemptItem;
          const newJobAttempt = unmarshall(
            record.dynamodb?.NewImage as Record<string, AttributeValue>,
          ) as JobAttemptItem;

          if (prevJobAttempt.scheduledAt !== newJobAttempt.scheduledAt) {
            const job = await jobService.getJob(newJobAttempt.jobId);
            await jobQueueService.addToQueue(
              job.queue,
              job.id,
              newJobAttempt.attempt,
              newJobAttempt.scheduledAt,
            );
          }
          break;
        }
      }
    }
  };
}
