vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockScheduleJob = vi.hoisted(() => vi.fn());

vi.mock('../helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../helpers')>();
  return {
    ...actual,
    scheduleJob: (...args: unknown[]) => mockScheduleJob(...args) as unknown,
  };
});

const mockCreateRegistryExecutorHandler = vi.hoisted(() => vi.fn());

vi.mock('../handlers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../handlers')>();
  return {
    ...actual,
    createRegistryExecutorHandler: (...args: unknown[]) =>
      mockCreateRegistryExecutorHandler(...args) as unknown,
  };
});

import { defineJobs } from './define-jobs';

interface TestJobs {
  syncItems: { cursor?: string };
  cloneItem: { itemId: string; count: number };
}

describe('defineJobs', () => {
  const jobs = defineJobs<TestJobs>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates scheduleJob to the untyped helper', async () => {
    mockScheduleJob.mockResolvedValue({ job: { id: 'job-1' }, jobAttempt: { attempt: 1 } });

    await jobs.scheduleJob('worker', 'cloneItem', { itemId: 'x', count: 2 });

    expect(mockScheduleJob).toHaveBeenCalledWith(
      'worker',
      'cloneItem',
      { itemId: 'x', count: 2 },
      undefined,
    );
  });

  it('passes scheduledAt through', async () => {
    mockScheduleJob.mockResolvedValue({});

    await jobs.scheduleJob('worker', 'syncItems', {}, '2025-06-01T00:00:00Z');

    expect(mockScheduleJob).toHaveBeenCalledWith('worker', 'syncItems', {}, '2025-06-01T00:00:00Z');
  });

  it('defineHandlers returns the handler map unchanged', () => {
    const handlers = {
      syncItems: vi.fn(),
      cloneItem: vi.fn(),
    };

    expect(jobs.defineHandlers(handlers)).toBe(handlers);
  });

  it('createRegistryExecutorHandler delegates to the untyped factory', () => {
    const handlers = { syncItems: vi.fn(), cloneItem: vi.fn() };
    const untypedHandler = vi.fn();
    mockCreateRegistryExecutorHandler.mockReturnValue(untypedHandler);

    const result = jobs.createRegistryExecutorHandler(handlers);

    expect(mockCreateRegistryExecutorHandler).toHaveBeenCalledWith(handlers);
    expect(result).toBe(untypedHandler);
  });

  it('enforces payload and fn key types at compile time', async () => {
    mockScheduleJob.mockResolvedValue({});

    // @ts-expect-error unknown fn key
    await jobs.scheduleJob('worker', 'notAJob', {});

    // @ts-expect-error wrong payload shape
    await jobs.scheduleJob('worker', 'cloneItem', { itemId: 'x' });

    expect(mockScheduleJob).toHaveBeenCalledTimes(2);
  });
});
