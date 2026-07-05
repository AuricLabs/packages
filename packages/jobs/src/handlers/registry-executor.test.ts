vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobService = vi.hoisted(() => ({
  getJob: vi.fn(),
}));

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
}));

const mockExecuteJob = vi.hoisted(() => vi.fn());

// JobContinuation and JobExecutionError must stay real classes
vi.mock('../helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../helpers')>();
  return {
    ...actual,
    executeJob: (...args: unknown[]) => mockExecuteJob(...args) as unknown,
  };
});

import { SQSEvent } from 'aws-lambda';

import { continueJob, StartJobContext } from '../helpers';

import { createRegistryExecutorHandler } from './registry-executor';

function createSqsRecord(messageId: string, body: object) {
  return {
    messageId,
    body: JSON.stringify(body),
    eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
    receiptHandle: `handle-${messageId}`,
    attributes: {},
    messageAttributes: {},
    md5OfBody: '',
    eventSource: 'aws:sqs',
    awsRegion: 'us-east-1',
  };
}

function eventFor(jobId: string): SQSEvent {
  return { Records: [createSqsRecord('msg-1', { jobId, queue: 'worker', attempt: 1 })] };
}

const mockContext = { job: { id: 'job-1' }, jobAttempt: { attempt: 1 } } as StartJobContext;

/** Runs the executor callback the handler passed to executeJob and returns its result. */
async function runExecutor(
  event: SQSEvent,
  handler: ReturnType<typeof createRegistryExecutorHandler>,
) {
  let executorResult: unknown;
  mockExecuteJob.mockImplementation(async (_message, executor) => {
    executorResult = await (executor as (context: StartJobContext) => Promise<unknown>)(
      mockContext,
    );
  });
  await handler(event);
  return executorResult;
}

describe('createRegistryExecutorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches to the handler matching job.fn with the payload and context', async () => {
    const job = { id: 'job-1', fn: 'syncItems', payload: { cursor: 'a' } };
    mockJobService.getJob.mockResolvedValue(job);

    const syncItems = vi.fn().mockResolvedValue({ processed: 5 });
    const handler = createRegistryExecutorHandler({ syncItems });

    const result = await runExecutor(eventFor('job-1'), handler);

    expect(syncItems).toHaveBeenCalledWith({ cursor: 'a' }, mockContext);
    expect(result).toEqual({ success: true, data: { processed: 5 } });
  });

  it('wraps a void handler return as a bare success', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', fn: 'noop', payload: {} });

    const handler = createRegistryExecutorHandler({ noop: vi.fn().mockResolvedValue(undefined) });

    const result = await runExecutor(eventFor('job-1'), handler);

    expect(result).toEqual({ success: true });
  });

  it('passes a JobContinuation straight through', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', fn: 'longRunning', payload: {} });
    const continuation = continueJob({ cursor: 'next' });

    const handler = createRegistryExecutorHandler({
      longRunning: vi.fn().mockResolvedValue(continuation),
    });

    const result = await runExecutor(eventFor('job-1'), handler);

    expect(result).toBe(continuation);
  });

  it('throws inside the executor when no handler is registered for job.fn', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', fn: 'unknownFn', payload: {} });

    const handler = createRegistryExecutorHandler({});

    let executorError: unknown;
    mockExecuteJob.mockImplementation(async (_message, executor) => {
      try {
        await (executor as (context: StartJobContext) => Promise<unknown>)(mockContext);
      } catch (error) {
        executorError = error;
      }
    });
    await handler(eventFor('job-1'));

    expect(executorError).toBeInstanceOf(Error);
    expect((executorError as Error).message).toContain('unknownFn');
  });

  it('reports a batch failure when the job cannot be loaded', async () => {
    mockJobService.getJob.mockRejectedValue(new Error('not found'));

    const handler = createRegistryExecutorHandler({});

    const response = await handler(eventFor('job-1'));

    expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
    expect(mockExecuteJob).not.toHaveBeenCalled();
  });
});
