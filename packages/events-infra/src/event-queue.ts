export interface CreateEventQueueOptions {
  batchSize?: number;
  visibilityTimeout?: string;
  dlqRetries?: number;
}

export function createEventQueue(
  name: string,
  subscriber: {
    handler: string;
    [key: string]: unknown;
  },
  options?: CreateEventQueueOptions,
): { queue: sst.aws.Queue; dlq: sst.aws.Queue } {
  const { batchSize = 10, visibilityTimeout = '30 seconds', dlqRetries = 1 } = options ?? {};

  const dlq = new sst.aws.Queue(`${name}DLQ`, {
    fifo: true,
  });

  const queue = new sst.aws.Queue(name, {
    fifo: true,
    visibilityTimeout,
    dlq: {
      queue: dlq.arn,
      retry: dlqRetries,
    },
  });

  queue.subscribe(subscriber, {
    batch: {
      size: batchSize,
      partialResponses: true,
    },
  });

  return { queue, dlq };
}
