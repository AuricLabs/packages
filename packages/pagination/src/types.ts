/**
 * Base pagination response structure for API responses
 */
export interface PaginationResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PaginationParams {
  cursor?: string | null;
  limit?: number;
}
