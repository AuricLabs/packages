import { describe, it, expect, vi, beforeEach } from 'vitest';

import { executeMigrate, executeRollback, getStatus } from './actions';

const mockInvokeLambdaAsync = vi.fn().mockResolvedValue(undefined);
const mockInvokeLambdaSync = vi.fn();

vi.mock('../../utils/lambda', () => ({
  invokeLambdaAsync: (...args: unknown[]) => mockInvokeLambdaAsync(...args),
  invokeLambdaSync: (...args: unknown[]) => mockInvokeLambdaSync(...args),
}));

describe('executeMigrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not-available message when function name is undefined', async () => {
    const result = await executeMigrate(undefined, {});

    expect(result.invoked).toBe(false);
    expect(result.message).toContain('not available');
    expect(mockInvokeLambdaAsync).not.toHaveBeenCalled();
  });

  it('invokes Lambda with direction up and no target', async () => {
    const result = await executeMigrate('my-fn', {});

    expect(result.invoked).toBe(true);
    expect(mockInvokeLambdaAsync).toHaveBeenCalledWith('my-fn', {
      direction: 'up',
      target: undefined,
    });
  });

  it('passes target through to Lambda', async () => {
    await executeMigrate('my-fn', { target: 'mig-1' });

    expect(mockInvokeLambdaAsync).toHaveBeenCalledWith('my-fn', {
      direction: 'up',
      target: 'mig-1',
    });
  });

  it('propagates invokeLambdaAsync rejection', async () => {
    mockInvokeLambdaAsync.mockRejectedValueOnce(new Error('Lambda invoke failed'));

    await expect(executeMigrate('my-fn', {})).rejects.toThrow('Lambda invoke failed');
  });
});

describe('executeRollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not-available message when function name is undefined', async () => {
    const result = await executeRollback(undefined, {});

    expect(result.invoked).toBe(false);
    expect(result.message).toContain('not available');
    expect(mockInvokeLambdaAsync).not.toHaveBeenCalled();
  });

  it('invokes Lambda with direction down', async () => {
    const result = await executeRollback('my-fn', {});

    expect(result.invoked).toBe(true);
    expect(mockInvokeLambdaAsync).toHaveBeenCalledWith('my-fn', {
      direction: 'down',
      target: undefined,
    });
  });

  it('passes target through to Lambda', async () => {
    await executeRollback('my-fn', { target: 'mig-1' });

    expect(mockInvokeLambdaAsync).toHaveBeenCalledWith('my-fn', {
      direction: 'down',
      target: 'mig-1',
    });
  });
});

describe('getStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty arrays when function name is undefined', async () => {
    const result = await getStatus(undefined);

    expect(result).toEqual({ pending: [], completed: [], failed: [] });
    expect(mockInvokeLambdaSync).not.toHaveBeenCalled();
  });

  it('invokes Lambda synchronously with status action', async () => {
    const expected = { pending: ['mig-1'], completed: [], failed: [] };
    mockInvokeLambdaSync.mockResolvedValue(expected);

    const result = await getStatus('my-fn');

    expect(result).toEqual(expected);
    expect(mockInvokeLambdaSync).toHaveBeenCalledWith('my-fn', { action: 'status' });
  });

  it('propagates invokeLambdaSync rejection', async () => {
    mockInvokeLambdaSync.mockRejectedValueOnce(new Error('Lambda sync failed'));

    await expect(getStatus('my-fn')).rejects.toThrow('Lambda sync failed');
  });
});
