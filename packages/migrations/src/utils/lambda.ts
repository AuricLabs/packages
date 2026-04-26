interface LambdaInvokeParams {
  FunctionName: string;
  InvocationType: string;
  Payload: string;
}

interface LambdaInvokeResult {
  Payload?: string | Uint8Array;
  FunctionError?: string;
}

interface LambdaClient {
  invoke: (params: LambdaInvokeParams) => Promise<LambdaInvokeResult>;
}

let cachedClient: LambdaClient | undefined;

async function getLambdaClient(): Promise<LambdaClient> {
  if (cachedClient) return cachedClient;
  const { Lambda } = await import('@aws-sdk/client-lambda');
  cachedClient = new Lambda() as unknown as LambdaClient;
  return cachedClient;
}

/**
 * Asynchronously invoke a Lambda function with the given payload.
 * Uses dynamic import so `@aws-sdk/client-lambda` stays an optional peer dependency.
 */
export async function invokeLambdaAsync(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const lambda = await getLambdaClient();

  await lambda.invoke({
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload),
  });
}

/**
 * Synchronously invoke a Lambda function and return the parsed response payload.
 * Uses `InvocationType: 'RequestResponse'` to wait for the result.
 */
export async function invokeLambdaSync<T = unknown>(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const lambda = await getLambdaClient();

  const response = await lambda.invoke({
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify(payload),
  });

  const raw = response.Payload
    ? typeof response.Payload === 'string'
      ? response.Payload
      : new TextDecoder().decode(response.Payload)
    : '';

  if (response.FunctionError) {
    const detail = raw || response.FunctionError;
    throw new Error(`Lambda ${functionName} error: ${detail}`);
  }

  if (!raw) {
    throw new Error(`Lambda ${functionName} returned empty response`);
  }

  return JSON.parse(raw) as T;
}
