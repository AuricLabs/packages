import { isProd } from '@auriclabs/env';
import { APIGatewayProxyResultV2 } from 'aws-lambda';
import { StatusCodes } from 'http-status-codes';

export type ApiResponse = APIGatewayProxyResultV2 & {
  body: string; // JSON stringified ApiResponseBody
};

export interface BaseResponseBody {
  timestamp: string;
  requestId?: string;
}

export type SuccessResponseBody<T> = BaseResponseBody & {
  data: T;
};

export type ErrorResponseBody = BaseResponseBody & {
  message: string;
  stack?: string;
  details?: unknown;
};

export interface BaseResponseBodyOptions {
  requestId: string;
}

export type SuccessBodyOptions<T> = BaseResponseBodyOptions & {
  data: T;
};

export type ErrorBodyOptions = BaseResponseBodyOptions & {
  message: string;
  stack?: string;
  [key: string]: unknown;
};

export type ApiResponseBody<T = unknown> = SuccessResponseBody<T> | ErrorResponseBody;

export interface ApiResponseOptions {
  statusCode: StatusCodes;
  body: ApiResponseBody;
  additionalHeaders?: Record<string, string>;
}

export interface BaseApiResponseOptions {
  statusCode: StatusCodes;
  additionalHeaders?: Record<string, string>;
}

export type SuccessApiResponseOptions<T> = BaseApiResponseOptions & SuccessBodyOptions<T>;

export type ErrorApiResponseOptions = BaseApiResponseOptions & ErrorBodyOptions;

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE,PATCH',
};

const createBaseResponseBody = (options: BaseResponseBodyOptions) => ({
  timestamp: new Date().toISOString(),
  requestId: options.requestId,
});

const successBody = <T>(options: SuccessBodyOptions<T>): ApiResponseBody<T> => ({
  data: options.data,
  ...createBaseResponseBody(options),
});

const errorBody = (options: ErrorBodyOptions): ApiResponseBody => ({
  ...options,
  ...createBaseResponseBody(options),
});

export const apiResponse = (options: ApiResponseOptions): ApiResponse => ({
  statusCode: options.statusCode,
  body: JSON.stringify(options.body),
  headers: {
    ...defaultHeaders,
    ...options.additionalHeaders,
  },
});

export const createSuccessApiResponse = <T>(options: SuccessApiResponseOptions<T>): ApiResponse =>
  apiResponse({
    statusCode: options.statusCode,
    body: successBody({
      data: options.data,
      requestId: options.requestId,
    }),
    additionalHeaders: options.additionalHeaders,
  });

export const createErrorApiResponse = ({
  statusCode,
  message,
  additionalHeaders,
  stack,
  ...other
}: ErrorApiResponseOptions): ApiResponse =>
  apiResponse({
    statusCode,
    body: errorBody({
      ...other,
      message,
      // only include stack trace for server errors
      stack: statusCode >= StatusCodes.INTERNAL_SERVER_ERROR && !isProd() ? stack : undefined,
    }),
    additionalHeaders,
  });
