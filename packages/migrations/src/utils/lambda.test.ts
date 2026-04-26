import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('@aws-sdk/client-lambda', () => ({
  Lambda: vi.fn(() => ({
    invoke: mockInvoke,
  })),
}));

// Re-import after mock setup — each test file gets fresh module state
// but we need to clear the cached client between tests
let invokeLambdaAsync: typeof import('./lambda').invokeLambdaAsync;
let invokeLambdaSync: typeof import('./lambda').invokeLambdaSync;

beforeEach(async () => {
  mockInvoke.mockReset();
  // Reset module to clear cached client
  vi.resetModules();
  vi.mock('@aws-sdk/client-lambda', () => ({
    Lambda: vi.fn(() => ({
      invoke: mockInvoke,
    })),
  }));
  const mod = await import('./lambda');
  invokeLambdaAsync = mod.invokeLambdaAsync;
  invokeLambdaSync = mod.invokeLambdaSync;
});

describe('invokeLambdaAsync', () => {
  it('invokes Lambda with Event invocation type', async () => {
    mockInvoke.mockResolvedValue({});

    await invokeLambdaAsync('my-function', { direction: 'up' });

    expect(mockInvoke).toHaveBeenCalledWith({
      FunctionName: 'my-function',
      InvocationType: 'Event',
      Payload: JSON.stringify({ direction: 'up' }),
    });
  });

  it('propagates errors', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    await expect(invokeLambdaAsync('my-function', { direction: 'up' })).rejects.toThrow(
      'Network error',
    );
  });
});

describe('invokeLambdaSync', () => {
  it('invokes Lambda with RequestResponse invocation type', async () => {
    mockInvoke.mockResolvedValue({
      Payload: JSON.stringify({ pending: [], completed: [], failed: [] }),
    });

    await invokeLambdaSync('my-function', { action: 'status' });

    expect(mockInvoke).toHaveBeenCalledWith({
      FunctionName: 'my-function',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({ action: 'status' }),
    });
  });

  it('returns parsed JSON payload', async () => {
    const expected = { pending: ['mig-1'], completed: [], failed: [] };
    mockInvoke.mockResolvedValue({
      Payload: JSON.stringify(expected),
    });

    const result = await invokeLambdaSync('my-function', { action: 'status' });
    expect(result).toEqual(expected);
  });

  it('decodes Uint8Array payload', async () => {
    const expected = { status: 'ok' };
    mockInvoke.mockResolvedValue({
      Payload: new TextEncoder().encode(JSON.stringify(expected)),
    });

    const result = await invokeLambdaSync('my-function', { action: 'status' });
    expect(result).toEqual(expected);
  });

  it('throws on FunctionError', async () => {
    mockInvoke.mockResolvedValue({
      FunctionError: 'Unhandled',
      Payload: 'some error detail',
    });

    await expect(invokeLambdaSync('my-function', { action: 'status' })).rejects.toThrow(
      'Lambda my-function error: some error detail',
    );
  });

  it('throws on FunctionError with empty payload', async () => {
    mockInvoke.mockResolvedValue({
      FunctionError: 'Unhandled',
    });

    await expect(invokeLambdaSync('my-function', { action: 'status' })).rejects.toThrow(
      'Lambda my-function error: Unhandled',
    );
  });

  it('throws on empty response payload', async () => {
    mockInvoke.mockResolvedValue({});

    await expect(invokeLambdaSync('my-function', { action: 'status' })).rejects.toThrow(
      'Lambda my-function returned empty response',
    );
  });
});
