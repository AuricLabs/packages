import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export interface SubscribeEventStreamConfig {
  table: sst.aws.Dynamo;
  bus?: sst.aws.Bus;
  listenerQueues: sst.aws.Queue[];
}

export function subscribeEventStream(config: SubscribeEventStreamConfig) {
  const { table, bus, listenerQueues } = config;

  const streamHandlerPath = require.resolve('@auriclabs/events/stream-handler');
  const handler = streamHandlerPath.replace(/\.[^.]+$/, '') + '.handler';

  const environment: Record<string, $util.Input<string>> = {
    QUEUE_URL_LIST: $jsonStringify(listenerQueues.map((queue) => queue.url)),
  };

  if (bus) {
    environment.EVENT_BUS_NAME = bus.name;
  }

  table.subscribe(
    'EventStoreTableStream',
    {
      handler,
      link: [...(bus ? [bus] : []), ...listenerQueues],
      environment,
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
