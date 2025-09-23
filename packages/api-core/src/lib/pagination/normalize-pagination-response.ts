import { PaginationResponse } from './types';

export interface DynamodbResponse<T> {
  data?: T[];
  cursor?: string | null;
}

export function normalizePaginationResponse<T>(
  response: DynamodbResponse<T>,
): PaginationResponse<T>;
export function normalizePaginationResponse<T>(
  response: Promise<DynamodbResponse<T>>,
): Promise<PaginationResponse<T>>;
export function normalizePaginationResponse<T>(
  response: DynamodbResponse<T> | Promise<DynamodbResponse<T>>,
): PaginationResponse<T> | Promise<PaginationResponse<T>> {
  if (response instanceof Promise) {
    return response.then(normalizePaginationResponse<T>);
  } else {
    return {
      data: response.data ?? [],
      cursor: response.cursor ?? null,
      hasMore: response.cursor != null,
    };
  }
}
