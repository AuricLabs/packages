const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
  ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {
    constructor() {
      super();
      this.name = 'ConditionalCheckFailedException';
    }
  },
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  TransactWriteCommand: vi.fn((input: unknown) => ({ input, _type: 'TransactWrite' })),
  GetCommand: vi.fn((input: unknown) => ({ input, _type: 'Get' })),
  QueryCommand: vi.fn((input: unknown) => ({ input, _type: 'Query' })),
}));

vi.mock('@auriclabs/pagination', () => ({
  normalizePaginationResponse: vi.fn((input: unknown) => input),
}));

import { TransactWriteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { createEventService } from './event-service';

interface TransactItem {
  TableName?: string;
  Key?: Record<string, string>;
  Item?: {
    pk?: string;
    sk?: string;
    itemType?: string;
    eventType?: string;
    payload?: unknown;
    version?: number;
    source?: string;
    schemaVersion?: number;
    occurredAt?: string;
    correlationId?: string;
    causationId?: string;
    actorId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface TransactWriteInput {
  TransactItems?: {
    Update?: TransactItem;
    Put?: TransactItem;
    [key: string]: unknown;
  }[];
}

interface QueryInput {
  ExpressionAttributeValues?: Record<string, unknown>;
  Limit?: number;
  [key: string]: unknown;
}

describe('event-service', () => {
  const TABLE_NAME = 'test-events';

  beforeEach(() => {
    mockSend.mockReset();
    vi.mocked(TransactWriteCommand).mockClear();
    vi.mocked(GetCommand).mockClear();
    vi.mocked(QueryCommand).mockClear();
  });

  describe('createEventService', () => {
    it('returns an object with all expected methods', () => {
      const service = createEventService(TABLE_NAME);
      expect(service).toHaveProperty('appendEvent');
      expect(service).toHaveProperty('getHead');
      expect(service).toHaveProperty('getEvent');
      expect(service).toHaveProperty('listEvents');
    });
  });

  describe('appendEvent', () => {
    it('sends TransactWriteCommand with correct table name and pk format', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({});

      await service.appendEvent({
        tenantId: 'tenant-1',
        aggregateType: 'order',
        aggregateId: 'order-123',
        source: 'order-service',
        expectedVersion: 0,
        idempotencyKey: 'idem-key-1',
        eventId: 'evt-abc',
        eventType: 'OrderCreated',
        payload: { total: 100 },
      });

      expect(TransactWriteCommand).toHaveBeenCalledTimes(1);
      const cmdInput = vi.mocked(TransactWriteCommand).mock.calls[0][0] as TransactWriteInput;

      // Check Update item (HEAD)
      const updateItem = cmdInput.TransactItems?.[0]?.Update;
      expect(updateItem?.TableName).toBe(TABLE_NAME);
      expect(updateItem?.Key).toEqual({ pk: 'AGG#order#order-123', sk: 'HEAD' });

      // Check Put item (event)
      const putItem = cmdInput.TransactItems?.[1]?.Put;
      expect(putItem?.TableName).toBe(TABLE_NAME);
      expect(putItem?.Item?.pk).toBe('AGG#order#order-123');
      expect(putItem?.Item?.sk).toBe('EVT#000000001');
      expect(putItem?.Item?.itemType).toBe('event');
      expect(putItem?.Item?.eventType).toBe('OrderCreated');
      expect(putItem?.Item?.payload).toEqual({ total: 100 });
      expect(putItem?.Item?.version).toBe(1);
      expect(putItem?.Item?.source).toBe('order-service');
      expect(putItem?.Item?.schemaVersion).toBe(1);
    });

    it('pads version number to 9 digits', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({});

      await service.appendEvent({
        tenantId: 'tenant-1',
        aggregateType: 'order',
        aggregateId: '1',
        source: 'test',
        expectedVersion: 41,
        idempotencyKey: 'k',
        eventId: 'e',
        eventType: 'T',
      });

      const cmdInput = vi.mocked(TransactWriteCommand).mock.calls[0][0] as TransactWriteInput;
      const putItem = cmdInput.TransactItems?.[1]?.Put;
      expect(putItem?.Item?.sk).toBe('EVT#000000042');
      expect(putItem?.Item?.version).toBe(42);
    });

    it('returns pk, sk, and version', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({});

      const result = await service.appendEvent({
        tenantId: 'tenant-1',
        aggregateType: 'wallet',
        aggregateId: 'w-1',
        source: 'billing',
        expectedVersion: 5,
        idempotencyKey: 'key',
        eventId: 'evt-1',
        eventType: 'CreditAdded',
      });

      expect(result).toEqual({
        pk: 'AGG#wallet#w-1',
        sk: 'EVT#000000006',
        version: 6,
      });
    });

    it('uses provided occurredAt instead of generating one', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({});

      await service.appendEvent({
        tenantId: 'tenant-1',
        aggregateType: 'order',
        aggregateId: '1',
        source: 'test',
        expectedVersion: 0,
        idempotencyKey: 'k',
        eventId: 'e',
        eventType: 'T',
        occurredAt: '2025-01-01T00:00:00.000Z',
      });

      const cmdInput = vi.mocked(TransactWriteCommand).mock.calls[0][0] as TransactWriteInput;
      const putItem = cmdInput.TransactItems?.[1]?.Put;
      expect(putItem?.Item?.occurredAt).toBe('2025-01-01T00:00:00.000Z');
    });

    it('includes optional metadata fields', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({});

      await service.appendEvent({
        tenantId: 'tenant-1',
        aggregateType: 'order',
        aggregateId: '1',
        source: 'test',
        expectedVersion: 0,
        idempotencyKey: 'k',
        eventId: 'e',
        eventType: 'T',
        correlationId: 'corr-1',
        causationId: 'cause-1',
        actorId: 'user-1',
        schemaVersion: 2,
      });

      const cmdInput = vi.mocked(TransactWriteCommand).mock.calls[0][0] as TransactWriteInput;
      const putItem = cmdInput.TransactItems?.[1]?.Put;
      expect(putItem?.Item?.correlationId).toBe('corr-1');
      expect(putItem?.Item?.causationId).toBe('cause-1');
      expect(putItem?.Item?.actorId).toBe('user-1');
      expect(putItem?.Item?.schemaVersion).toBe(2);
    });

    it('throws OCC error on ConditionalCheckFailedException', async () => {
      const service = createEventService(TABLE_NAME);
      const { ConditionalCheckFailedException } = await import('@aws-sdk/client-dynamodb');
      mockSend.mockRejectedValue(new ConditionalCheckFailedException());

      await expect(
        service.appendEvent({
          tenantId: 'tenant-1',
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          expectedVersion: 3,
          idempotencyKey: 'k',
          eventId: 'e',
          eventType: 'T',
        }),
      ).rejects.toThrow('OCC failed for aggregate order/o-1: expectedVersion=3');
    });

    it('re-throws non-OCC errors', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockRejectedValue(new Error('Network error'));

      await expect(
        service.appendEvent({
          tenantId: 'tenant-1',
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          expectedVersion: 0,
          idempotencyKey: 'k',
          eventId: 'e',
          eventType: 'T',
        }),
      ).rejects.toThrow('Network error');
    });
  });

  describe('getHead', () => {
    it('sends GetCommand with correct pk and sk=HEAD', async () => {
      const service = createEventService(TABLE_NAME);
      const head = { pk: 'AGG#order#o-1', sk: 'HEAD', currentVersion: 5 };
      mockSend.mockResolvedValue({ Item: head });

      const result = await service.getHead('order', 'o-1');

      expect(GetCommand).toHaveBeenCalledWith({
        TableName: TABLE_NAME,
        Key: { pk: 'AGG#order#o-1', sk: 'HEAD' },
      });
      expect(result).toEqual(head);
    });

    it('returns undefined when no head exists', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await service.getHead('order', 'nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('getEvent', () => {
    it('sends GetCommand with correct pk and padded version sk', async () => {
      const service = createEventService(TABLE_NAME);
      const event = { pk: 'AGG#order#o-1', sk: 'EVT#000000003', eventType: 'OrderCreated' };
      mockSend.mockResolvedValue({ Item: event });

      const result = await service.getEvent('order', 'o-1', 3);

      expect(GetCommand).toHaveBeenCalledWith({
        TableName: TABLE_NAME,
        Key: { pk: 'AGG#order#o-1', sk: 'EVT#000000003' },
      });
      expect(result).toEqual(event);
    });

    it('returns undefined when event does not exist', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await service.getEvent('order', 'o-1', 999);
      expect(result).toBeUndefined();
    });
  });

  describe('listEvents', () => {
    it('sends QueryCommand with default range when no bounds specified', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

      await service.listEvents({ aggregateType: 'order', aggregateId: 'o-1' });

      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': 'AGG#order#o-1',
          ':from': 'EVT#000000000',
          ':to': 'EVT#999999999',
        },
        ScanIndexForward: true,
        Limit: undefined,
      });
    });

    it('respects fromVersionExclusive', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

      await service.listEvents({
        aggregateType: 'order',
        aggregateId: 'o-1',
        fromVersionExclusive: 5,
      });

      const cmdInput = vi.mocked(QueryCommand).mock.calls[0][0] as QueryInput;
      // fromVersionExclusive=5 means start from version 6
      expect(cmdInput.ExpressionAttributeValues?.[':from']).toBe('EVT#000000006');
    });

    it('respects toVersionInclusive', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

      await service.listEvents({
        aggregateType: 'order',
        aggregateId: 'o-1',
        toVersionInclusive: 10,
      });

      const cmdInput = vi.mocked(QueryCommand).mock.calls[0][0] as QueryInput;
      expect(cmdInput.ExpressionAttributeValues?.[':to']).toBe('EVT#000000010');
    });

    it('respects limit parameter', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Items: [], LastEvaluatedKey: undefined });

      await service.listEvents({
        aggregateType: 'order',
        aggregateId: 'o-1',
        limit: 25,
      });

      const cmdInput = vi.mocked(QueryCommand).mock.calls[0][0] as QueryInput;
      expect(cmdInput.Limit).toBe(25);
    });

    it('returns items from query result', async () => {
      const service = createEventService(TABLE_NAME);
      const events = [
        { pk: 'AGG#order#o-1', sk: 'EVT#000000001', eventType: 'OrderCreated' },
        { pk: 'AGG#order#o-1', sk: 'EVT#000000002', eventType: 'OrderUpdated' },
      ];
      mockSend.mockResolvedValue({ Items: events, LastEvaluatedKey: undefined });

      const result = await service.listEvents({ aggregateType: 'order', aggregateId: 'o-1' });

      expect(result).toEqual({ data: events, cursor: undefined });
    });

    it('extracts cursor from LastEvaluatedKey sk', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({
        Items: [{ pk: 'AGG#order#o-1', sk: 'EVT#000000001' }],
        LastEvaluatedKey: { pk: 'AGG#order#o-1', sk: 'EVT#000000001' },
      });

      const result = await service.listEvents({ aggregateType: 'order', aggregateId: 'o-1' });

      expect(result).toEqual({
        data: [{ pk: 'AGG#order#o-1', sk: 'EVT#000000001' }],
        cursor: 'EVT#000000001',
      });
    });

    it('returns empty data array when Items is undefined', async () => {
      const service = createEventService(TABLE_NAME);
      mockSend.mockResolvedValue({ Items: undefined, LastEvaluatedKey: undefined });

      const result = await service.listEvents({ aggregateType: 'order', aggregateId: 'o-1' });

      expect(result).toEqual({ data: [], cursor: undefined });
    });
  });
});
