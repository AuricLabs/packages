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
  busName: string;
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

  async function sendToQueuesBatch(eventRecords: EventRecord[]) {
    await Promise.all(config.queueUrls.map((queue) => sendToQueueBatch(eventRecords, queue)));
  }

  async function sendToQueueBatch(eventRecords: EventRecord[], queue: string) {
    const batches = chunkArray(eventRecords, BATCH_SIZE);

    for (const batch of batches) {
      try {
        const entries = batch.map((eventRecord, index) => ({
          Id: `${eventRecord.eventId}-${index}`,
          MessageBody: JSON.stringify(eventRecord),
          MessageGroupId: eventRecord.aggregateId,
          MessageDeduplicationId: eventRecord.eventId,
        }));

        await sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queue,
            Entries: entries,
          }),
        );
      } catch (error) {
        logger.error({ error, batch, queue }, 'Error sending batch to queue');
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

        await eventBridge.send(
          new PutEventsCommand({
            Entries: entries,
          }),
        );
      } catch (error) {
        logger.error({ error, batch }, 'Error sending batch to bus');
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
      await Promise.all([sendToBusBatch(eventRecords), sendToQueuesBatch(eventRecords)]);
    }
  };
}
