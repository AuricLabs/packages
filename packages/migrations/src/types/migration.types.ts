import type { TimeoutManager } from './timeout.types';

export interface MigrationContext extends Record<string, unknown> {
  /**
   * When running inside a Lambda handler, the timeout manager is automatically
   * injected into the context. Use `context.timeoutManager?.shouldStop()` inside
   * long-running loops to check if the Lambda is approaching its timeout.
   */
  timeoutManager?: TimeoutManager;
}

export interface Migration<TContext extends MigrationContext = MigrationContext> {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  up: (context: TContext) => Promise<Record<string, unknown> | undefined | void>;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  down: (context: TContext) => Promise<Record<string, unknown> | undefined | void>;
}

export interface MigrationFile<TContext extends MigrationContext = MigrationContext> {
  id: string;
  timestamp: string;
  name: string;
  filePath: string;
  migration: Migration<TContext>;
}

/** A migration entry for direct registration (bundler-friendly alternative to migrationsDir). */
export interface MigrationEntry<TContext extends MigrationContext = MigrationContext> {
  id: string;
  migration: Migration<TContext>;
}
