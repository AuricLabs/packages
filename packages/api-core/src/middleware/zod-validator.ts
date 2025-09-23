import { MiddlewareObj } from '@middy/core';
import { BadRequestError } from 'http-errors-enhanced';
import { z, ZodRawShape, ZodTypeAny } from 'zod';

import { CoreErrorCodes } from '../errors';

export type ZodValidatorOptions = {
  body?: ZodTypeAny;
  queryStringParameters?: ZodTypeAny;
  pathParameters?: ZodTypeAny;
  headers?: ZodTypeAny;
} & ZodRawShape;

type ZOutputType<T extends ZodValidatorOptions> = z.infer<ReturnType<typeof z.object<T>>>;

export const zodValidator = <T extends ZodValidatorOptions>(
  options: T,
): MiddlewareObj<ZOutputType<T>> => {
  return {
    name: 'ZodValidator',
    before: (request) => {
      const { event } = request;
      const result = z.object(options).safeParse(event);

      if (!result.success) {
        throw new BadRequestError(CoreErrorCodes.CORE_VALIDATION_FAILED, {
          issues: result.error.issues,
        });
      }

      Object.assign(event, result.data);
    },
  };
};
