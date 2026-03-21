import { logger } from '@auriclabs/logger';
import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

import { executeJob, JobExecutionError } from '../helpers';
import { getJobService, getLambdaExecutorService } from '../init';
import { JobMessage } from '../types';

export function createLambdaExecutorHandler() {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const jobService = getJobService();
    const lambdaExecutorService = getLambdaExecutorService();

    const response: SQSBatchResponse = {
      batchItemFailures: [],
    };

    const isFifoQueue =
      event.Records.length > 0 && event.Records[0].eventSourceARN.endsWith('.fifo');
    logger.info({ isFifoQueue, totalRecords: event.Records.length }, 'Processing event records');

    async function processEventRecord(record: SQSRecord) {
      const message = JSON.parse(record.body) as JobMessage;
      const job = await jobService.getJob(message.jobId);
      try {
        await executeJob(message, () =>
          lambdaExecutorService.trigger(message.jobId, job.fn, job.payload),
        );
      } catch (error: unknown) {
        if (error instanceof JobExecutionError && error.started) {
          return;
        }
        throw error;
      }
    }

    if (isFifoQueue) {
      let failed = false;
      for (const record of event.Records) {
        if (failed) {
          throw new Error('FAILED STATE');
        }
        try {
          await processEventRecord(record);
        } catch (error: unknown) {
          if (error instanceof JobExecutionError && error.started) {
            continue;
          }
          failed = true;
          response.batchItemFailures.push({
            itemIdentifier: record.messageId,
          });
        }
      }
      if (failed) {
        throw new Error('Failed to process event record');
      }
    } else {
      await Promise.all(
        event.Records.map(async (record) => {
          try {
            await processEventRecord(record);
          } catch {
            response.batchItemFailures.push({
              itemIdentifier: record.messageId,
            });
          }
        }),
      );
    }
    return response;
  };
}
