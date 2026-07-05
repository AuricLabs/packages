import { logger } from '@auriclabs/logger';
import { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

import { JobExecutionError } from '../helpers';
import { JobMessage } from '../types';

export type ProcessJobRecord = (message: JobMessage, record: SQSRecord) => Promise<void>;

/**
 * Shared SQS batch loop for job executors. Handles FIFO (sequential,
 * stop-on-failure) vs standard (parallel, partial batch failures) queues and
 * swallows JobExecutionError for attempts that already started — their
 * outcome is tracked on the attempt row, so redelivering the message could
 * only double-run the job.
 */
export function createSqsJobConsumer(processRecord: ProcessJobRecord) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const response: SQSBatchResponse = {
      batchItemFailures: [],
    };

    const isFifoQueue =
      event.Records.length > 0 && event.Records[0].eventSourceARN.endsWith('.fifo');
    logger.info({ isFifoQueue, totalRecords: event.Records.length }, 'Processing event records');

    async function processEventRecord(record: SQSRecord) {
      const message = JSON.parse(record.body) as JobMessage;
      try {
        await processRecord(message, record);
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
        } catch {
          // started JobExecutionErrors were already swallowed by processEventRecord
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
