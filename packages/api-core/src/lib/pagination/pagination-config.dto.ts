import { z } from 'zod';

/**
 * Pagination configuration for different modules/use cases
 */
export interface PaginationDtoSchemaConfig {
  defaultLimit?: number;
  maxLimit?: number;
  minLimit?: number;
}

/**
 * Creates a Zod schema for pagination query parameters with configurable limits
 */
export function createPaginationQuerySchema({
  maxLimit = 100,
  defaultLimit = 10,
  minLimit = 1,
}: PaginationDtoSchemaConfig = {}) {
  const limitSchema = z.string().optional();
  const limitSchemaWithDefault =
    defaultLimit > 0 ? limitSchema.default(defaultLimit.toString()) : limitSchema;

  return z.object({
    cursor: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val?.length ? val : undefined)), // avoid empty string
    limit: limitSchemaWithDefault.transform((val) => {
      if (val === undefined) {
        return undefined;
      }
      let parser = z.coerce.number().int().min(minLimit);
      if (maxLimit > 0) {
        parser = parser.max(maxLimit);
      }
      return parser.parse(val);
    }),
  });
}

export type PaginationConfigDto = z.infer<ReturnType<typeof createPaginationQuerySchema>>;

export const paginationConfigDto = createPaginationQuerySchema();
