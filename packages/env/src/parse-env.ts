import z from 'zod';

import { defaultErrorHandler } from './handlers';

/**
 * Type for the error handler function used in parseEnv.
 * Can either return a value (for recovery) or just handle the error (void).
 */
export type HandleErrorFn<
  T extends z.ZodRawShape | z.ZodObject<z.ZodRawShape> | readonly string[],
> =
  | ((
      error: unknown,
      args?: ParseEnvArgs<T>,
    ) =>
      | (T extends readonly string[]
          ? Record<T[number], string>
          : T extends z.ZodRawShape
            ? z.output<z.ZodObject<T>>
            : T extends z.ZodObject<z.ZodRawShape>
              ? z.output<T>
              : never)
      | undefined)
  | ((error: unknown, args?: ParseEnvArgs<T>) => void);

/**
 * Options for parseEnv, extending dotenv's config options.
 * Allows passing a custom error handler.
 */
export interface ParseEnvOptions<
  T extends z.ZodRawShape | z.ZodObject<z.ZodRawShape> | readonly string[],
> {
  handleError?: HandleErrorFn<T>;
  envPrefix?: string;
}

/**
 * Argument types for parseEnv.
 * If T is a string array, accepts a list of strings and optional options.
 * If T is a Zod schema, accepts the schema and optional options.
 */
export type ParseEnvArgs<T extends z.ZodRawShape | z.ZodObject<z.ZodRawShape> | readonly string[]> =
  T extends readonly string[]
    ? [...T, options?: ParseEnvOptions<T>]
    : [T, options?: ParseEnvOptions<T>];

/**
 * Type for the response of parseEnv.
 */
export type ParseEnvResponse<
  T extends z.ZodRawShape | z.ZodObject<z.ZodRawShape> | readonly string[],
> = T extends readonly string[]
  ? Record<T[number], string>
  : T extends z.ZodRawShape
    ? z.output<z.ZodObject<T>>
    : T extends z.ZodObject<z.ZodRawShape>
      ? z.output<T>
      : never;

/**
 * Overload: parseEnv with string keys.
 */
export function parseEnv<T extends readonly string[]>(
  ...args: ParseEnvArgs<T>
): Record<T[number], string>;

/**
 * Overload: parseEnv with Zod schema shape.
 */
export function parseEnv<T extends z.ZodRawShape>(
  schema: T,
  options?: ParseEnvOptions<T>,
): z.output<z.ZodObject<T>>;

/**
 * Overload: parseEnv with Zod object.
 */
export function parseEnv<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  options?: ParseEnvOptions<T>,
): z.output<T>;

/**
 * Main implementation of parseEnv.
 * Loads environment variables using dotenv, validates them using Zod,
 * and handles errors using the provided or default error handler.
 */
export function parseEnv<T extends z.ZodRawShape | z.ZodObject<z.ZodRawShape> | readonly string[]>(
  ...args: ParseEnvArgs<T>
): ParseEnvResponse<T> {
  // Extract handleError and dotenv options from the last argument if it's an object
  const { handleError = defaultErrorHandler, envPrefix }: ParseEnvOptions<T> =
    args.length > 1 && args[args.length - 1] instanceof Object
      ? (args[args.length - 1] as ParseEnvOptions<T>)
      : {};

  // Determine the schema: either a Zod schema or build one from string keys
  const schema =
    args[0] instanceof Object
      ? args[0]
      : args
          .filter((arg): arg is string => typeof arg === 'string')
          .reduce<Record<string, z.ZodString>>((acc, curr) => {
            acc[curr] = z.string();
            return acc;
          }, {});

  const env: Record<string, string | undefined> =
    typeof process !== 'undefined'
      ? process.env
      : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - this is required for tests
        ((import.meta as unknown as { env?: Record<string, string> } | undefined)?.env ?? {});
  let result: Record<string, string | undefined>;

  // If envPrefix is provided, filter the env variables to only include those that start with the prefix
  if (envPrefix) {
    result = Object.fromEntries(
      Object.entries(env)
        .filter(([key]) => key.startsWith(envPrefix))
        .map(([key, value]) => [key.replace(envPrefix, ''), value]),
    );
  } else {
    result = { ...env };
  }

  try {
    // Validate the loaded env vars using the schema
    // If schema is already a ZodObject, use it directly; otherwise wrap it in z.object()
    if (schema instanceof z.ZodObject) {
      // @ts-expect-error - the schema here can be multiple types so we just ignore the type error
      return schema.parse(result);
    } else {
      // @ts-expect-error - the schema here can be multiple types so we just ignore the type error
      return z.object(schema).parse(result);
    }
  } catch (error) {
    // If an error occurs, call the error handler
    const newResult = handleError(error, args);

    // If the error handler returns a value, return it (for recovery)
    if (newResult && typeof newResult === 'object') {
      return newResult;
    }

    // Otherwise, exit the process
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  }
}
