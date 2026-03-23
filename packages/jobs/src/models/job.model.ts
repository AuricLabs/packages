import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  CreateEntityItem,
  CustomAttributeType,
  Entity,
  EntityItem,
  UpdateEntityItem,
} from 'electrodb';
import { v4 as uuidv4 } from 'uuid';

import { jobStatus, JobStatus } from '../types';

export function createJobModel(tableName: string) {
  return new Entity(
    {
      model: {
        entity: 'job',
        version: '1',
        service: 'job',
      },
      attributes: {
        id: {
          type: 'string',
          label: 'jobId',
          required: true,
          readOnly: true,
          default: uuidv4,
        },
        queue: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        fn: {
          type: 'string',
          readOnly: true,
          required: true,
        },
        status: {
          type: CustomAttributeType<JobStatus>('string'),
          required: true,
          default: jobStatus.pending,
        },
        totalAttempts: {
          type: 'number',
          required: true,
          default: 0,
        },
        payload: {
          type: CustomAttributeType<unknown>('any'),
          readOnly: true,
          required: true,
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
        job: {
          pk: {
            field: 'pk',
            composite: ['id'],
          },
          sk: {
            field: 'sk',
            composite: [],
          },
        },
        jobStatuses: {
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
      },
    },
    {
      table: tableName,
      client: new DynamoDBClient(),
    },
  );
}

export type JobEntity = ReturnType<typeof createJobModel>;
export type JobItem = EntityItem<JobEntity>;
export type JobCreateFields = Omit<
  CreateEntityItem<JobEntity>,
  'id' | 'createdAt' | 'updatedAt' | 'totalAttempts'
>;
export type JobUpdateFields = Partial<
  Omit<UpdateEntityItem<JobEntity>, 'updatedAt' | 'totalAttempts'>
>;
