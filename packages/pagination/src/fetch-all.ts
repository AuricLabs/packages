import { logger } from '@auriclabs/logger';

/**
 * Fetch all data from a paginated API
 * @param cb - The callback function to fetch the data
 * @returns The fetched data
 */
export const fetchAll = async <T extends Record<string, unknown[] | undefined> | unknown[]>(
  cb: (cursor: string | null | undefined) => Promise<{
    data: T;
    cursor: string | null | undefined;
  }>,
) => {
  const arrayData: unknown[] = [];
  const objectData: Partial<Record<string, unknown[]>> = {};
  let cursor: string | null | undefined;
  let isArrayData = false;

  do {
    const { data: batch, cursor: nextCursor } = await cb(cursor);
    cursor = nextCursor;
    if (Array.isArray(batch)) {
      isArrayData = true;
      arrayData.push(...batch);
    } else {
      if (typeof batch === 'undefined') {
        logger.debug({ batch }, 'Received an undefined batch response');
        continue;
      }

      Object.entries(batch).forEach(([key, values]) => {
        objectData[key] ??= [];
        objectData[key].push(...(values as unknown[]));
      });
    }
  } while (typeof cursor === 'string');

  return isArrayData ? (arrayData as T) : (objectData as T);
};
