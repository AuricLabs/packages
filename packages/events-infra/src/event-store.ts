export interface CreateEventStoreOptions {
  transform?: {
    table?: Record<string, unknown>;
  };
}

export function createEventStore(name: string, options?: CreateEventStoreOptions) {
  return new sst.aws.Dynamo(name, {
    fields: {
      pk: 'string',
      sk: 'string',
    },
    primaryIndex: {
      hashKey: 'pk',
      rangeKey: 'sk',
    },
    globalIndexes: {},
    stream: 'new-and-old-images',
    transform: {
      table: {
        tableClass: 'STANDARD_INFREQUENT_ACCESS',
        ...options?.transform?.table,
      },
    },
  });
}
