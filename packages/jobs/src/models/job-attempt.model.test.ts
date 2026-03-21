vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}));

const MockEntity = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    query: {},
  })),
);

vi.mock('electrodb', () => ({
  Entity: MockEntity,
  CustomAttributeType: vi.fn((type: string) => type),
}));

import { createJobAttemptModel } from './job-attempt.model';

describe('createJobAttemptModel', () => {
  it('returns an entity-like object', () => {
    const entity = createJobAttemptModel('test-table');
    expect(entity).toBeTruthy();
    expect(entity).toHaveProperty('get');
    expect(entity).toHaveProperty('create');
    expect(entity).toHaveProperty('patch');
  });

  it('passes the table name to the Entity constructor', () => {
    createJobAttemptModel('my-table');
    expect(MockEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.objectContaining({
          entity: 'job-attempt',
          version: '1',
          service: 'job',
        }),
      }),
      expect.objectContaining({
        table: 'my-table',
      }),
    );
  });
});
