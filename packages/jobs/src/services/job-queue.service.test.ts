const mockSend = vi.hoisted(() => vi.fn());

const originalEnv = vi.hoisted(() => {
  const original = process.env.QUEUE_URL_LIST;
  process.env.QUEUE_URL_LIST = JSON.stringify([
    ['lambda', 'https://sqs.example.com/lambda-queue'],
    ['other', 'https://sqs.example.com/other-queue'],
  ]);
  return original;
});

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({ send: mockSend })),
  SendMessageCommand: vi.fn((input: unknown) => ({ input })),
}));

vi.mock('@auriclabs/api-core', () => ({
  retry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@auriclabs/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createJobQueueService, JobQueueServiceInstance } from './job-queue.service';

describe('jobQueueService', () => {
  let service: JobQueueServiceInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createJobQueueService();
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.QUEUE_URL_LIST = originalEnv;
    } else {
      delete process.env.QUEUE_URL_LIST;
    }
  });

  describe('getQueueUrl', () => {
    it('returns URL for known queue', () => {
      expect(service.getQueueUrl('lambda')).toBe('https://sqs.example.com/lambda-queue');
    });

    it('returns URL for another known queue', () => {
      expect(service.getQueueUrl('other')).toBe('https://sqs.example.com/other-queue');
    });

    it('throws when queue is not found', () => {
      expect(() => service.getQueueUrl('unknown')).toThrow('Queue URL not found for id: unknown');
    });
  });

  describe('addToQueue', () => {
    it('sends SQS message with correct body and delay', async () => {
      mockSend.mockResolvedValue({ MessageId: 'msg-123' });

      const result = await service.addToQueue('lambda', 'job-1', 1);

      expect(result).toBe('msg-123');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.example.com/lambda-queue',
            MessageBody: JSON.stringify({ jobId: 'job-1', queue: 'lambda', attempt: 1 }),
            DelaySeconds: 0,
          },
        }),
      );
    });

    it('sends SQS message with scheduled delay', async () => {
      mockSend.mockResolvedValue({ MessageId: 'msg-456' });
      const futureDate = new Date(Date.now() + 60000).toISOString();

      const result = await service.addToQueue('lambda', 'job-1', 1, futureDate);

      expect(result).toBe('msg-456');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          input: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            DelaySeconds: expect.any(Number),
          }),
        }),
      );
    });

    it('throws when job ID is empty', () => {
      expect(() => service.addToQueue('lambda', '  ', 1)).toThrow('Job ID is required');
    });

    it('throws when no MessageId is returned', async () => {
      mockSend.mockResolvedValue({});

      await expect(service.addToQueue('lambda', 'job-1', 1)).rejects.toThrow(
        'Failed to add job to queue. No message id returned.',
      );
    });

    it('throws and logs when SQS send fails', async () => {
      const error = new Error('SQS error');
      mockSend.mockRejectedValue(error);

      const loggerModule: typeof import('@auriclabs/logger') = await import('@auriclabs/logger');

      await expect(service.addToQueue('lambda', 'job-1', 1)).rejects.toThrow('SQS error');
      expect(vi.mocked(loggerModule.logger.error)).toHaveBeenCalledWith(
        expect.objectContaining({ err: error, jobId: 'job-1' }),
        expect.any(String),
      );
    });
  });

  describe('getQueueDelaySeconds', () => {
    it('returns 0 when no scheduledAt', () => {
      expect(service.getQueueDelaySeconds()).toBe(0);
      expect(service.getQueueDelaySeconds(undefined)).toBe(0);
    });

    it('calculates delay for future date', () => {
      const futureDate = new Date(Date.now() + 120000).toISOString();
      const delay = service.getQueueDelaySeconds(futureDate);
      expect(delay).toBeGreaterThanOrEqual(118);
      expect(delay).toBeLessThanOrEqual(121);
    });

    it('caps delay at 900 seconds', () => {
      const farFuture = new Date(Date.now() + 2000000).toISOString();
      expect(service.getQueueDelaySeconds(farFuture)).toBe(900);
    });

    it('returns 0 for past dates', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      expect(service.getQueueDelaySeconds(pastDate)).toBe(0);
    });
  });
});
