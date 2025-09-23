import { z } from 'zod';

export const optionalStringDto = <T extends string>(...keys: T[]) => {
  const schema = {} as Record<T, z.ZodOptional<z.ZodString>>;

  for (const key of keys) {
    schema[key] = z.string().optional();
  }

  return z.object(schema).strip();
};
