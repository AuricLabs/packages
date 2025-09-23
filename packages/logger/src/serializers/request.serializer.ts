import { AxiosRequestConfig } from 'axios';

// Sensitive headers that should be removed from logs (case-insensitive)
const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-forwarded-for',
  'x-real-ip',
];

/**
 * Safely converts headers to a plain object and removes sensitive entries
 */
const sanitizeHeaders = (headers: unknown): Record<string, unknown> => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  // Convert to plain object, handling AxiosHeaders and other types
  let plainHeaders: Record<string, unknown>;

  if (typeof headers === 'object' && 'toJSON' in headers && typeof headers.toJSON === 'function') {
    // Handle AxiosHeaders and similar objects with toJSON method
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    plainHeaders = headers.toJSON() as Record<string, unknown>;
  } else {
    // Fallback to Object.fromEntries for other cases
    try {
      plainHeaders = Object.fromEntries(Object.entries(headers as Record<string, unknown>));
    } catch {
      return {};
    }
  }

  // Remove sensitive headers case-insensitively
  const sanitizedHeaders: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(plainHeaders)) {
    const lowerKey = key.toLowerCase();
    if (!SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitizedHeaders[key] = value;
    }
  }

  return sanitizedHeaders;
};

export const requestSerializer = (request: AxiosRequestConfig) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!request) {
    return undefined;
  }

  const url = new URL(request.url ?? '', `http://${request.baseURL ?? 'localhost'}`);

  const headers = sanitizeHeaders(request.headers);

  const searchParams = new URLSearchParams(url.searchParams).toString();

  return {
    method: request.method,
    url: request.url,
    baseURL: request.baseURL,
    headers,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    data: request.data,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    params: request.params,
    timeout: request.timeout,
    withCredentials: request.withCredentials,
    responseType: request.responseType,
    maxContentLength: request.maxContentLength,
    maxBodyLength: request.maxBodyLength,
    validateStatus: request.validateStatus,
    query: searchParams ? `?${searchParams}` : undefined,
  };
};
