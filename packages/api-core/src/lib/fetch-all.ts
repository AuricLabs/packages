// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchAll = async <T extends Record<string, any[]> | any[]>(
  cb: (cursor: string | null | undefined) => Promise<{
    data: T;
    cursor?: string | null;
  }>,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayData: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objectData: Record<string, any[]> = {};
  let cursor: string | null | undefined;
  let isArrayData = false;

  do {
    const { data: batch, cursor: nextCursor } = await cb(cursor);
    if (Array.isArray(batch)) {
      isArrayData = true;
      arrayData.push(...batch);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (typeof batch === 'object' && batch !== null) {
      Object.entries(batch).forEach(([key, values]) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!objectData[key]) {
          objectData[key] = [];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        objectData[key].push(...values);
      });
    } else {
      throw new Error('Invalid fetchAll response');
    }
    cursor = nextCursor;
  } while (cursor);

  return isArrayData ? (arrayData as T) : (objectData as T);
};
