import { logger } from '@auriclabs/logger';
import { jest, describe, expect, it, beforeEach } from '@jest/globals';

import { fetchAll } from './fetch-all';

// Mock the logger
jest.mock('@auriclabs/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

describe('fetchAll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Array data responses', () => {
    it('should fetch all data from a single page', async () => {
      const mockCallback = jest
        .fn<(cursor: string | null | undefined) => Promise<{ data: number[]; cursor: null }>>()
        .mockResolvedValue({
          data: [1, 2, 3],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3]);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(undefined);
    });

    it('should fetch all data from multiple pages', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{ data: number[]; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          data: [1, 2, 3],
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          data: [4, 5, 6],
          cursor: 'page3',
        })
        .mockResolvedValueOnce({
          data: [7, 8, 9],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenNthCalledWith(1, undefined);
      expect(mockCallback).toHaveBeenNthCalledWith(2, 'page2');
      expect(mockCallback).toHaveBeenNthCalledWith(3, 'page3');
    });

    it('should handle empty array responses', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: number[]; cursor: null }>>()
        .mockResolvedValue({
          data: [],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([]);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed array and empty responses', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{ data: number[]; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          data: [1, 2],
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          data: [],
          cursor: 'page3',
        })
        .mockResolvedValueOnce({
          data: [3, 4],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3, 4]);
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });
  });

  describe('Object data responses', () => {
    it('should fetch all data from a single page with object structure', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: { users: string[]; posts: string[] }; cursor: null }>>()
        .mockResolvedValue({
          data: {
            users: ['user1', 'user2'],
            posts: ['post1', 'post2'],
          },
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual({
        users: ['user1', 'user2'],
        posts: ['post1', 'post2'],
      });
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should fetch all data from multiple pages with object structure', async () => {
      const mockCallback = jest
        .fn<
          (
            cursor: string | null | undefined,
          ) => Promise<{ data: { users: string[]; posts: string[] }; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          data: {
            users: ['user1', 'user2'],
            posts: ['post1'],
          },
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          data: {
            users: ['user3'],
            posts: ['post2', 'post3'],
          },
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual({
        users: ['user1', 'user2', 'user3'],
        posts: ['post1', 'post2', 'post3'],
      });
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle object responses with different keys across pages', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{
            data: { users?: string[]; posts?: string[]; comments?: string[] };
            cursor: string | null;
          }>
        >()
        .mockResolvedValueOnce({
          data: {
            users: ['user1'],
          },
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          data: {
            posts: ['post1', 'post2'],
            comments: ['comment1'],
          },
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual({
        users: ['user1'],
        posts: ['post1', 'post2'],
        comments: ['comment1'],
      });
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle empty object responses', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: Record<never, never>; cursor: null }>>()
        .mockResolvedValue({
          data: {},
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual({});
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Undefined batch handling', () => {
    it('should skip undefined batch responses and log debug message', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{ data: number[]; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          data: [1, 2],
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          // @ts-expect-error - test case for undefined batch
          data: undefined,
          cursor: 'page3',
        })
        .mockResolvedValueOnce({
          data: [3, 4],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3, 4]);
      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(logger.debug).toHaveBeenCalledWith(
        { batch: undefined },
        'Received an undefined batch response',
      );
    });

    it('should handle multiple undefined batches', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{ data: number[]; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          // @ts-expect-error - test case for undefined batch
          data: undefined,
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          // @ts-expect-error - test case for undefined batch
          data: undefined,
          cursor: 'page3',
        })
        .mockResolvedValueOnce({
          data: [1, 2],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2]);
      expect(mockCallback).toHaveBeenCalledTimes(3);
      expect(logger.debug).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle null cursor correctly', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: number[]; cursor: null }>>()
        .mockResolvedValue({
          data: [1, 2, 3],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3]);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined cursor correctly', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: number[]; cursor: undefined }>>()
        .mockResolvedValue({
          data: [1, 2, 3],
          cursor: undefined,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3]);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle empty string cursor', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{ data: number[]; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          data: [1, 2],
          cursor: '',
        })
        .mockResolvedValueOnce({
          data: [3, 4],
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      expect(result).toStrictEqual([1, 2, 3, 4]);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed array and object data types', async () => {
      const mockCallback = jest
        .fn<
          (cursor: string | null | undefined) => Promise<{ data: number[]; cursor: string | null }>
        >()
        .mockResolvedValueOnce({
          data: [1, 2],
          cursor: 'page2',
        })
        .mockResolvedValueOnce({
          data: {
            // @ts-expect-error - test case for mixed array and object data types
            items: [3, 4],
          },
          cursor: null,
        });

      const result = await fetchAll(mockCallback);

      // Should return object data since the last batch was an object
      expect(result).toStrictEqual([1, 2]);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from the callback function', async () => {
      const error = new Error('API Error');
      const mockCallback = jest
        .fn<() => Promise<{ data: number[]; cursor: string | null }>>()
        .mockRejectedValue(error);

      await expect(fetchAll(mockCallback)).rejects.toThrow('API Error');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from subsequent callback calls', async () => {
      const error = new Error('API Error');
      const mockCallback = jest
        .fn<() => Promise<{ data: number[]; cursor: string | null }>>()
        .mockResolvedValueOnce({
          data: [1, 2],
          cursor: 'page2',
        })
        .mockRejectedValueOnce(error);

      await expect(fetchAll(mockCallback)).rejects.toThrow('API Error');
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety for array data', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: string[]; cursor: null }>>()
        .mockResolvedValue({
          data: ['string1', 'string2'],
          cursor: null,
        });

      const result = await fetchAll<string[]>(mockCallback);

      expect(result).toStrictEqual(['string1', 'string2']);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should maintain type safety for object data', async () => {
      const mockCallback = jest
        .fn<() => Promise<{ data: { users: string[]; posts: string[] }; cursor: null }>>()
        .mockResolvedValue({
          data: {
            users: ['user1', 'user2'],
            posts: ['post1'],
          },
          cursor: null,
        });

      const result = await fetchAll<{ users: string[]; posts: string[] }>(mockCallback);

      expect(result).toStrictEqual({
        users: ['user1', 'user2'],
        posts: ['post1'],
      });
      expect(typeof result).toBe('object');
      expect(Array.isArray(result)).toBe(false);
    });
  });
});
