/**
 * The subset of the SST components namespace that {@link createJobTable} needs
 * at runtime.
 *
 * `@auriclabs/jobs-infra` ships as ESM (`dist/index.mjs`). SST's config
 * evaluator injects the `sst` global into config source via an esbuild
 * `onLoad` plugin whose filter is `\.(js|ts|jsx|tsx)$` — it deliberately skips
 * `.mjs`/`.cjs`. (The `$app` / `$jsonStringify` / `$output` globals arrive via
 * esbuild `Define`/`Inject`, which are extension-agnostic, so those keep
 * working; only the `sst` namespace and the `@pulumi/*` provider aliases come
 * from the skipped `onLoad` channel.) A bare `sst.aws.Dynamo` reference in this
 * `.mjs` file therefore throws `ReferenceError: sst is not defined` at deploy
 * time. Taking `sst` as a parameter — exactly as `@auriclabs/migrations`'
 * `createTable(sst)` does — sidesteps the injection entirely.
 */
export interface JobTableSstProvider {
  aws: {
    Dynamo: typeof sst.aws.Dynamo;
  };
}

export function createJobTable(sst: JobTableSstProvider, name: string) {
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
