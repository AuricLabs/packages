import { retry } from '@auriclabs/api-core';
import { logger } from '@auriclabs/logger';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

import { JobMessage } from '../types';

const sqsClient = new SQSClient();

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const queueUrlMap = new Map<string, string>(JSON.parse(process.env.QUEUE_URL_LIST ?? '[]'));

export interface JobQueueServiceInstance {
  getQueueUrl(id: string): string;
  addToQueue(queue: string, jobId: string, attempt: number, scheduledAt?: string): Promise<string>;
  getQueueDelaySeconds(scheduledAt?: string): number;
}

export function createJobQueueService(): JobQueueServiceInstance {
  return {
    getQueueUrl(id: string): string {
      const url = queueUrlMap.get(id);
      if (!url) {
        throw new Error(`Queue URL not found for id: ${id}`);
      }
      return url;
    },

    addToQueue(
      queue: string,
      jobId: string,
      attempt: number,
      scheduledAt?: string,
    ): Promise<string> {
      if (!jobId.trim()) {
        throw new Error('Job ID is required');
      }
      return retry(async () => {
        try {
          const response = await sqsClient.send(
            new SendMessageCommand({
              QueueUrl: this.getQueueUrl(queue),
              MessageBody: JSON.stringify({
                jobId,
                queue,
                attempt,
              } satisfies JobMessage),
              DelaySeconds: this.getQueueDelaySeconds(scheduledAt),
            }),
          );
          if (!response.MessageId) {
            throw new Error('Failed to add job to queue. No message id returned.');
          }
          return response.MessageId;
        } catch (error) {
          logger.error({ err: error, jobId }, 'Error adding job to queue');
          throw error;
        }
      });
    },

    getQueueDelaySeconds(scheduledAt?: string): number {
      if (!scheduledAt) {
        return 0;
      }
      return Math.min(
        900,
        Math.max(0, Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000)),
      );
    },
  };
}
