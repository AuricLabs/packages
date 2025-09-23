import { z } from 'zod';

// Extract the base type without the optional marker
type BaseKey<T extends string> = T extends `${infer U}?` ? U : T;

// Create a type that maps each key to either a required or optional UUID string
type SchemaType<T extends string> = {
  [K in BaseKey<T>]: T extends `${K}?` ? z.ZodOptional<z.ZodString> : z.ZodString;
};

// UUID regex to support all UUIDS including non standard UUIDs
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

// UUID schema
export const uuidSchema = z.string().regex(UUID_REGEX, 'Invalid UUID');

/**
 * Creates a Zod schema for UUID fields where keys ending with '?' are optional
 * @example
 * // Creates a schema with required orgId and optional projectId
 * const schema = uuidDto('orgId', 'projectId?');
 */
export const uuidDto = <T extends string>(...keys: T[]) => {
  const schema = {} as Record<string, z.ZodString | z.ZodOptional<z.ZodString>>;

  for (const key of keys) {
    const isOptional = key.endsWith('?');
    const cleanKey = (isOptional ? key.slice(0, -1) : key) as BaseKey<T>;
    schema[cleanKey] = isOptional ? uuidSchema.optional() : uuidSchema;
  }

  return z.object(schema as SchemaType<T>).strip();
};
