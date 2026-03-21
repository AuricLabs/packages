import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  CreateEntityItem,
  CustomAttributeType,
  Entity,
  EntityItem,
  UpdateEntityItem,
} from 'electrodb';

import { jobStatus, JobStatus } from '../types';

export function createJobAttemptModel(tableName: string) {
  return new Entity(
    {
      model: {
        entity: 'job-attempt',
        version: '1',
        service: 'job',
      },
      attributes: {
        jobId: {
          type: 'string',
          readOnly: true,
          required: true,
        },
        attempt: {
          type: 'number',
          readOnly: true,
          required: true,
        },
        status: {
          type: CustomAttributeType<JobStatus>('string'),
          required: true,
          default: jobStatus.pending,
        },
        error: {
          type: 'string',
          required: false,
          set: (value: string | undefined) => (value ? value.substring(0, 1000) : undefined),
        },
        response: {
          type: 'any',
          required: false,
        },
        duration: {
          type: 'number',
          required: false,
        },
        startedAt: {
          type: 'string',
          required: false,
        },
        scheduledAt: {
          type: 'string',
          required: false,
        },
        completedAt: {
          type: 'string',
          required: false,
        },
        failedAt: {
          type: 'string',
          required: false,
        },
        createdAt: {
          type: 'string',
          readOnly: true,
          required: true,
          default: () => new Date().toISOString(),
        },
        updatedAt: {
          type: 'string',
          watch: '*',
          required: true,
          default: () => new Date().toISOString(),
          set: () => new Date().toISOString(),
        },
      },
      indexes: {
        jobAttempt: {
          pk: {
            field: 'pk',
            composite: ['jobId'],
          },
          sk: {
            field: 'sk',
            composite: ['attempt'],
          },
        },
        jobAttempts: {
          index: 'numberIndex',
          pk: {
            field: 'numberIndexPk',
            composite: ['jobId'],
          },
          sk: {
            field: 'numberIndexSk',
            template: '${attempt}',
            composite: ['attempt'],
          },
        },
      },
    },
    {
      table: tableName,
      client: new DynamoDBClient(),
    },
  );
}

export type JobAttemptEntity = ReturnType<typeof createJobAttemptModel>;
export type JobAttemptItem = EntityItem<JobAttemptEntity>;
export type JobAttemptCreateFields = Pick<
  CreateEntityItem<JobAttemptEntity>,
  'jobId' | 'attempt' | 'scheduledAt'
>;
export type JobAttemptUpdateFields = Partial<
  Omit<UpdateEntityItem<JobAttemptEntity>, 'updatedAt'>
>;
