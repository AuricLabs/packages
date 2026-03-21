const mockSend = vi.hoisted(() => vi.fn());

const originalEnv = vi.hoisted(() => {
  const original = process.env.LAMBDA_FUNCTION_LIST;
  process.env.LAMBDA_FUNCTION_LIST = JSON.stringify([
    ['myFn', 'arn:aws:lambda:us-east-1:123456789:function:myFn'],
    ['otherFn', 'arn:aws:lambda:us-east-1:123456789:function:otherFn'],
  ]);
  return original;
});

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => ({ send: mockSend })),
  InvokeCommand: vi.fn((input: unknown) => ({ input })),
}));

vi.mock('@auriclabs/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createLambdaExecutorService, LambdaExecutorServiceInstance } from './lambda-executor.service';

describe('lambdaExecutorService', () => {
  let service: LambdaExecutorServiceInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createLambdaExecutorService();
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.LAMBDA_FUNCTION_LIST = originalEnv;
    } else {
      delete process.env.LAMBDA_FUNCTION_LIST;
    }
  });

  describe('getFunctionName', () => {
    it('returns the function ARN for a known function', () => {
      expect(service.getFunctionName('myFn')).toBe(
        'arn:aws:lambda:us-east-1:123456789:function:myFn',
      );
    });

    it('throws when function is not found', () => {
      expect(() => service.getFunctionName('unknown')).toThrow(
        "Lambda function name not found for 'unknown'",
      );
    });
  });

  describe('trigger', () => {
    it('invokes Lambda and parses response', async () => {
      const responsePayload = { success: true, data: { result: 'ok' } };
      mockSend.mockResolvedValue({
        Payload: new TextEncoder().encode(JSON.stringify(responsePayload)),
      });

      const result = await service.trigger('job-1', 'myFn', { input: 'data' });

      expect(result).toEqual(responsePayload);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            FunctionName: 'arn:aws:lambda:us-east-1:123456789:function:myFn',
            Payload: JSON.stringify({ input: 'data' }),
          },
        }),
      );
    });

    it('returns null when payload is empty', async () => {
      mockSend.mockResolvedValue({ Payload: new Uint8Array(0) });

      const result = await service.trigger('job-1', 'myFn', {});
      expect(result).toBeNull();
    });

    it('returns null when payload is undefined', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.trigger('job-1', 'myFn', {});
      expect(result).toBeNull();
    });

    it('throws on FunctionError', async () => {
      mockSend.mockResolvedValue({
        FunctionError: 'Unhandled',
        Payload: new TextEncoder().encode('{}'),
      });

      await expect(service.trigger('job-1', 'myFn', {})).rejects.toThrow(
        'Lambda function error: Unhandled',
      );
    });

    it('throws when fn is empty', async () => {
      await expect(service.trigger('job-1', '', {})).rejects.toThrow(
        'Job job-1 does not have a function name specified',
      );
    });

    it('throws and logs on Lambda send error', async () => {
      const error = new Error('Lambda error');
      mockSend.mockRejectedValue(error);
      const { logger } = vi.mocked(await import('@auriclabs/logger'));

      await expect(service.trigger('job-1', 'myFn', {})).rejects.toThrow('Lambda error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: error, jobId: 'job-1' }),
        expect.any(String),
      );
    });
  });
});
