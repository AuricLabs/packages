import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Entity, type EntityItem, type EntityConfiguration } from 'electrodb';

export function createMigrationRecordEntity(config?: EntityConfiguration) {
  return new Entity(
    {
      model: {
        entity: 'migration-record',
        version: '1',
        service: 'migrations',
      },
      attributes: {
        id: {
          type: 'string',
          required: true,
        },
        name: {
          type: 'string',
          required: true,
        },
        status: {
          type: [
            'pending',
            'running',
            'completed',
            'failed',
            'rolling_back',
            'rolled_back',
          ] as const,
          required: true,
        },
        direction: {
          type: ['up', 'down'] as const,
          required: true,
        },
        startedAt: {
          type: 'number',
          required: true,
        },
        completedAt: {
          type: 'number',
          required: false,
        },
        error: {
          type: 'string',
          required: false,
        },
        metadata: {
          type: 'any',
          required: false,
        },
        executionId: {
          type: 'string',
          required: true,
        },
        duration: {
          type: 'number',
          required: false,
        },
        description: {
          type: 'string',
          required: false,
        },
        output: {
          type: 'string',
          required: false,
        },
        outputTruncated: {
          type: 'boolean',
          required: false,
        },
        createdAt: {
          type: 'number',
          readOnly: true,
          required: true,
          default: () => Date.now(),
        },
        updatedAt: {
          type: 'number',
          watch: '*',
          required: true,
          default: () => Date.now(),
          set: () => Date.now(),
        },
      },
      indexes: {
        primary: {
          pk: {
            field: 'pk',
            composite: ['id'],
          },
          sk: {
            field: 'sk',
            composite: ['direction', 'executionId'],
          },
        },
        byStatus: {
          index: 'gsi1',
          pk: {
            field: 'gsi1pk',
            composite: ['status'],
          },
          sk: {
            field: 'gsi1sk',
            composite: ['id'],
          },
        },
        byExecution: {
          index: 'gsi2',
          pk: {
            field: 'gsi2pk',
            composite: ['executionId'],
          },
          sk: {
            field: 'gsi2sk',
            composite: ['id'],
          },
        },
      },
    },
    config ?? {
      table: 'migrations',
      client: new DynamoDBClient(),
    },
  );
}

export type MigrationRecordEntity = ReturnType<typeof createMigrationRecordEntity>;
export type MigrationRecordItem = EntityItem<MigrationRecordEntity>;
