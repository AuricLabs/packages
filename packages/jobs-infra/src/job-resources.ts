import { FunctionWithName } from '@auriclabs/sst-utils';

export interface LambdaJobResource {
  id: string;
  executor: 'lambda';
  queue: sst.aws.Queue;
  fns: FunctionWithName[];
}

export interface WorkerJobResource {
  id: string;
  executor?: never;
  queue: sst.aws.Queue;
}

export type JobResource = LambdaJobResource | WorkerJobResource;

export interface RegisterJobResourcesConfig {
  table: sst.aws.Dynamo;
  resources: JobResource[];
  handlerPaths: {
    stream: string;
    executor: string;
  };
}

export function registerJobResources(config: RegisterJobResourcesConfig) {
  const { table, resources, handlerPaths } = config;
  const QUEUE_URL_LIST = $jsonStringify(resources.map(({ id, queue }) => [id, queue.url]));

  table.subscribe(
    'JobTableStream',
    {
      handler: handlerPaths.stream,
      link: [table, ...resources.map(({ queue }) => queue)],
      environment: {
        QUEUE_URL_LIST,
      },
    },
    {
      filters: [
        {
          dynamodb: {
            NewImage: {
              __edb_e__: {
                S: ['job-attempt'],
              },
            },
          },
        },
        {
          dynamodb: {
            OldImage: {
              __edb_e__: {
                S: ['job-attempt'],
              },
            },
          },
        },
      ],
    },
  );

  resources.forEach((resource) => {
    if (!('executor' in resource)) {
      return;
    }

    if (resource.executor === 'lambda') {
      resource.queue.subscribe(
        {
          handler: handlerPaths.executor,
          link: [table, resource.queue, ...resource.fns],
          environment: {
            LAMBDA_FUNCTION_LIST: $jsonStringify(resource.fns.map((f) => [f.name, f.arn])),
          },
        },
        {
          batch: {
            size: 10,
            window: '3 seconds',
            partialResponses: true,
          },
        },
      );
    }
  });
}
