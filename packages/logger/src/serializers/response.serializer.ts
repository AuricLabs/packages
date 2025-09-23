export const responseSerializer = (
  response: unknown,
):
  | {
      headers: Record<string, unknown>;
      status: number;
      statusText: string;
      data: unknown;
    }
  | undefined => {
  // Runtime guard: check if response exists and has typical AxiosResponse shape
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!response || typeof response !== 'object' || response === null) {
    return undefined;
  }

  const responseObj = response as Record<string, unknown>;

  // Check for required AxiosResponse properties
  if (
    typeof responseObj.status !== 'number' ||
    typeof responseObj.statusText !== 'string' ||
    !responseObj.headers ||
    typeof responseObj.headers !== 'object'
  ) {
    return undefined;
  }

  // Safely coerce headers to plain Record<string, unknown> and redact sensitive values
  const headers = responseObj.headers as Record<string, unknown>;
  const safeHeaders: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    // Redact Set-Cookie and similar header values
    if (key.toLowerCase().includes('set-cookie') && typeof value === 'string') {
      safeHeaders[key] = '[REDACTED]';
    } else {
      safeHeaders[key] = value;
    }
  }

  return {
    headers: safeHeaders,
    status: responseObj.status,
    statusText: responseObj.statusText,
    data: responseObj.data,
  };
};
