export interface SubscribeEventStreamConfig {
  table: sst.aws.Dynamo;
  bus: sst.aws.Bus;
  listenerQueues: sst.aws.Queue[];
  handlerPath: string;
}

export function subscribeEventStream(config: SubscribeEventStreamConfig) {
  const { table, bus, listenerQueues, handlerPath } = config;

  table.subscribe(
    'EventStoreTableStream',
    {
      handler: handlerPath,
      link: [bus, ...listenerQueues],
      environment: {
        QUEUE_URL_LIST: $jsonStringify(listenerQueues.map((queue) => queue.url)),
      },
    },
    {
      filters: [
        {
          dynamodb: {
            NewImage: {
              itemType: { S: ['event'] },
            },
          },
        },
      ],
    },
  );
}
