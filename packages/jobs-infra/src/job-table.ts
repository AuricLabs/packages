export function createJobTable(name: string) {
  return new sst.aws.Dynamo(name, {
    fields: {
      pk: 'string',
      sk: 'string',
      numberIndexPk: 'string',
      numberIndexSk: 'number',
      gsi1pk: 'string',
      gsi1sk: 'string',
    },
    primaryIndex: {
      hashKey: 'pk',
      rangeKey: 'sk',
    },
    globalIndexes: {
      numberIndex: { hashKey: 'numberIndexPk', rangeKey: 'numberIndexSk' },
      gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
    },
    stream: 'new-and-old-images',
  });
}
