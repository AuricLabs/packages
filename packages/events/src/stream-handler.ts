import { logger } from '@auriclabs/logger';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { kebabCase } from 'lodash-es';

import { AggregateHead, EventRecord } from './types';

const BATCH_SIZE = 10;

export interface CreateStreamHandlerConfig {
  busName?: string;
  queueUrls: string[];
}

/**
 * Creates a Lambda handler for DynamoDB stream events.
 * Processes INSERT events from the event store table and forwards them to SQS queues and EventBridge.
 */
export function createStreamHandler(config: CreateStreamHandlerConfig) {
  const sqsClient = new SQSClient();
  const eventBridge = new EventBridgeClient({});

  function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  function summarizeBatchForLog(batch: EventRecord[]) {
    return batch.map((eventRecord) => ({
      eventId: eventRecord.eventId,
      aggregateId: eventRecord.aggregateId,
      aggregateType: eventRecord.aggregateType,
      eventType: eventRecord.eventType,
    }));
  }

  async function sendToQueuesBatch(eventRecords: EventRecord[]) {
    await Promise.all(config.queueUrls.map((queue) => sendToQueueBatch(eventRecords, queue)));
  }

  async function sendToQueueBatch(eventRecords: EventRecord[], queue: string) {
    const batches = chunkArray(eventRecords, BATCH_SIZE);
    // SQS FIFO queues require MessageGroupId + MessageDeduplicationId on every entry;
    // standard queues reject both as InvalidParameterValue. Queue URLs always end in
    // `.fifo` for FIFO queues, so the suffix is the canonical detection.
    const isFifo = queue.endsWith('.fifo');

    for (const batch of batches) {
      try {
        const entries = batch.map((eventRecord, index) => ({
          Id: `${eventRecord.eventId}-${index}`,
          MessageBody: JSON.stringify(eventRecord),
          ...(isFifo && {
            MessageGroupId: eventRecord.aggregateId,
            MessageDeduplicationId: eventRecord.eventId,
          }),
        }));

        const res = await sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queue,
            Entries: entries,
          }),
        );

        // SendMessageBatch returns 200 with per-entry failures in Failed[] for
        // partial-success scenarios (oversize body, duplicate Id, invalid attribute
        // for queue type, throttling). Treat any Failed entry as a hard failure so
        // misconfigured queues page loudly instead of dropping events.
        if (res.Failed && res.Failed.length > 0) {
          logger.error(
            {
              queue,
              failedCount: res.Failed.length,
              failed: res.Failed.map((f) => ({
                Id: f.Id,
                Code: f.Code,
                SenderFault: f.SenderFault,
                Message: f.Message,
              })),
              batch: summarizeBatchForLog(batch),
            },
            'SQS batch had failed entries',
          );
          throw new Error(
            `SQS batch send had ${String(res.Failed.length)} failed entries on ${queue}`,
          );
        }
      } catch (error) {
        logger.error(
          { error, queue, batch: summarizeBatchForLog(batch) },
          'Error sending batch to queue',
        );
        throw error;
      }
    }
  }

  async function sendToBusBatch(eventRecords: EventRecord[]) {
    const batches = chunkArray(eventRecords, BATCH_SIZE);

    for (const batch of batches) {
      try {
        const entries = batch.map((eventRecord) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const source = eventRecord.source ?? kebabCase(eventRecord.aggregateType.split('.')[0]);
          return {
            Source: source,
            DetailType: eventRecord.eventType,
            Detail: JSON.stringify(eventRecord),
            EventBusName: config.busName,
          };
        });

        const res = await eventBridge.send(
          new PutEventsCommand({
            Entries: entries,
          }),
        );

        // PutEvents returns 200 with FailedEntryCount > 0 and per-entry ErrorCode on
        // partial failures. Mirror the SQS path: any failed entry is a hard failure.
        if (res.FailedEntryCount && res.FailedEntryCount > 0) {
          logger.error(
            {
              failedCount: res.FailedEntryCount,
              failed: (res.Entries ?? [])
                .map((entry, idx) => ({
                  idx,
                  ErrorCode: entry.ErrorCode,
                  ErrorMessage: entry.ErrorMessage,
                }))
                .filter((entry) => entry.ErrorCode),
              batch: summarizeBatchForLog(batch),
            },
            'EventBridge PutEvents had failed entries',
          );
          throw new Error(
            `EventBridge PutEvents had ${String(res.FailedEntryCount)} failed entries`,
          );
        }
      } catch (error) {
        logger.error(
          { error, batch: summarizeBatchForLog(batch) },
          'Error sending batch to bus',
        );
        throw error;
      }
    }
  }

  return async (event: DynamoDBStreamEvent): Promise<void> => {
    const eventRecords = event.Records.filter((record) => record.eventName === 'INSERT')
      .map((record) => {
        try {
          const data = record.dynamodb?.NewImage;
          return unmarshall(data as Record<string, AttributeValue>) as EventRecord | AggregateHead;
        } catch (error) {
          logger.error({ error, record }, 'Error unmarshalling event record');
          return undefined;
        }
      })
      .filter((eventRecord): eventRecord is EventRecord => eventRecord?.itemType === 'event');

    if (eventRecords.length > 0) {
      const tasks: Promise<void>[] = [sendToQueuesBatch(eventRecords)];
      if (config.busName) {
        tasks.push(sendToBusBatch(eventRecords));
      }
      await Promise.all(tasks);
    }
  };
}
