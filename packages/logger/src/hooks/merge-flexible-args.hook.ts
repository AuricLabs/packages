import { format } from 'util';

import { AxiosError } from 'axios';
import { LogFn, Logger } from 'pino';

// Custom hook to support flexible argument ordering in pino
export function mergeFlexibleArgsHook(this: Logger, inputArgs: Parameters<LogFn>, method: LogFn) {
  // If we have multiple arguments, intelligently merge them
  if (inputArgs.length > 1) {
    const formatArgs: unknown[] = [];
    const contextObjects: Record<string, unknown>[] = [];
    let errorObject: Error | undefined;

    // Process each argument
    inputArgs.forEach((arg) => {
      if (arg instanceof Error) {
        // Errors get special treatment - store for the 'err' property
        errorObject = arg;
      } else if (typeof arg === 'object' && arg !== null) {
        // Objects become context, but handle 'error' property specially
        const processedObj = { ...arg };

        // If the object has an 'error' property, rename it to 'err' to follow pino convention
        if ('error' in processedObj) {
          // @ts-expect-error - err does not exist in this type
          processedObj.err = processedObj.error;
          delete processedObj.error;
        }

        contextObjects.push(processedObj);
      } else {
        // Collect all non-object primitives and strings for util.format
        formatArgs.push(arg);
      }
    });

    // Use util.format to build the final message, preserving printf placeholders and non-string primitives
    const message = formatArgs.length > 0 ? format(...formatArgs) : 'Log entry';

    // Merge all context objects
    const mergedContext = contextObjects.reduce((acc, obj) => {
      return { ...acc, ...obj };
    }, {});

    // Add error object to 'err' property if we found one
    if (errorObject) {
      mergedContext.err = errorObject;
    }

    if (mergedContext.err instanceof AxiosError) {
      mergedContext.req = mergedContext.err.config;
      mergedContext.res = mergedContext.err.response;
    }

    // Call the method with message first, then context (pino's expected order)
    method.call(this, mergedContext, message);
    return;
  }

  // Single argument or no arguments - pass through as-is
  method.apply(this, inputArgs);
}
