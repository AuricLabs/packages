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

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

import { createJobModel } from './job.model';

describe('createJobModel', () => {
  it('returns an entity-like object', () => {
    const entity = createJobModel('test-table');
    expect(entity).toBeTruthy();
    expect(entity).toHaveProperty('get');
    expect(entity).toHaveProperty('create');
    expect(entity).toHaveProperty('patch');
  });

  it('passes the table name to the Entity constructor', () => {
    createJobModel('my-table');

    expect(MockEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        model: expect.objectContaining({
          entity: 'job',
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
