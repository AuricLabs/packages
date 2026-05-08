import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Resource } from 'sst';

import { createMigrationRecordEntity, type MigrationRecordEntity } from '../models';

import type {
  MigrationDirection,
  MigrationRecord,
  MigrationStatus,
  MigrationStorage,
} from '../../types';

export interface DynamoDBMigrationStorageOptions {
  tableName?: string;
  client?: DynamoDBClient;
}

interface ElectroDBResponse {
  data: Record<string, unknown>[];
  cursor: string | null;
}

export class DynamoDBMigrationStorage implements MigrationStorage {
  private entity: MigrationRecordEntity;

  constructor(options?: DynamoDBMigrationStorageOptions) {
    // When the consumer supplies `tableName`, skip the SST `Resource` lookup
    // entirely — the lookup throws when SST link env vars aren't present
    // (e.g. running outside Lambda, like the local dashboard CLI), even
    // before optional-chaining can short-circuit.
    let tableName = options?.tableName;
    if (!tableName) {
      try {
        const resourceTableName = (
          Resource as unknown as Record<string, Record<string, string> | undefined>
        ).MigrationsTable?.name;
        tableName = resourceTableName ?? '';
      } catch {
        tableName = '';
      }
    }
    const client = options?.client ?? new DynamoDBClient();

    this.entity = createMigrationRecordEntity({ table: tableName, client });
  }

  async getRecord(id: string, direction?: MigrationDirection): Promise<MigrationRecord | null> {
    const query = direction
      ? this.entity.query.primary({ id, direction })
      : this.entity.query.primary({ id });
    const { data: records } = (await query.go()) as unknown as ElectroDBResponse;
    if (records.length === 0) return null;

    const mapped = records.map((r) => this.toMigrationRecord(r));
    const sorted = mapped.sort((a, b) => b.createdAt - a.createdAt);
    return sorted[0];
  }

  async getAllRecords(): Promise<MigrationRecord[]> {
    const records: MigrationRecord[] = [];
    let cursor: string | null = null;

    do {
      const response = (await this.entity.scan.go({
        cursor: cursor ?? undefined,
      })) as unknown as ElectroDBResponse;
      records.push(...response.data.map((r) => this.toMigrationRecord(r)));
      cursor = response.cursor;
    } while (cursor);

    return records;
  }

  async getRecordsByStatus(status: MigrationStatus): Promise<MigrationRecord[]> {
    const records: MigrationRecord[] = [];
    let cursor: string | null = null;

    do {
      const response = (await this.entity.query.byStatus({ status }).go({
        cursor: cursor ?? undefined,
      })) as unknown as ElectroDBResponse;
      records.push(...response.data.map((r) => this.toMigrationRecord(r)));
      cursor = response.cursor;
    } while (cursor);

    return records;
  }

  async getRecordsByExecutionId(executionId: string): Promise<MigrationRecord[]> {
    const records: MigrationRecord[] = [];
    let cursor: string | null = null;

    do {
      const response = (await this.entity.query.byExecution({ executionId }).go({
        cursor: cursor ?? undefined,
      })) as unknown as ElectroDBResponse;
      records.push(...response.data.map((r) => this.toMigrationRecord(r)));
      cursor = response.cursor;
    } while (cursor);

    return records;
  }

  async createRecord(
    record: Omit<MigrationRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<MigrationRecord> {
    // Use put() instead of create() so re-running a migration after rollback
    // overwrites the previous record with the same (id, direction) key.
    const { data } = (await this.entity
      .put({
        id: record.id,
        name: record.name,
        status: record.status,
        direction: record.direction,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        error: record.error,
        metadata: record.metadata,
        executionId: record.executionId,
        duration: record.duration,
        description: record.description,
        output: record.output,
        outputTruncated: record.outputTruncated,
      })
      .go()) as unknown as { data: Record<string, unknown> };

    return this.toMigrationRecord(data);
  }

  async updateRecord(
    id: string,
    direction: MigrationDirection,
    executionId: string,
    updates: Partial<Omit<MigrationRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MigrationRecord> {
    const { data } = (await this.entity
      .patch({ id, direction, executionId })
      .set({
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.completedAt !== undefined && { completedAt: updates.completedAt }),
        ...(updates.error !== undefined && { error: updates.error }),
        ...(updates.metadata !== undefined && { metadata: updates.metadata }),
        ...(updates.duration !== undefined && { duration: updates.duration }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.output !== undefined && { output: updates.output }),
        ...(updates.outputTruncated !== undefined && { outputTruncated: updates.outputTruncated }),
      })
      .go({ response: 'all_new' })) as unknown as { data: Record<string, unknown> };

    return this.toMigrationRecord(data);
  }

  private toMigrationRecord(item: Record<string, unknown>): MigrationRecord {
    return {
      id: item.id as string,
      name: item.name as string,
      status: item.status as MigrationStatus,
      direction: item.direction as MigrationDirection,
      startedAt: item.startedAt as number,
      completedAt: item.completedAt as number | undefined,
      error: item.error as string | undefined,
      metadata: item.metadata as Record<string, unknown> | undefined,
      executionId: item.executionId as string,
      duration: item.duration as number | undefined,
      description: item.description as string | undefined,
      output: item.output as string | undefined,
      outputTruncated: item.outputTruncated as boolean | undefined,
      createdAt: item.createdAt as number,
      updatedAt: item.updatedAt as number,
    };
  }
}
