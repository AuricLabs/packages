import { describe, expect, it } from 'vitest';

import { normalizePaginationResponse, DynamodbResponse } from './normalize-pagination-response';
import { PaginationResponse } from './types';

describe('normalizePaginationResponse', () => {
  describe('Synchronous responses', () => {
    it('should normalize a complete DynamodbResponse', () => {
      const response: DynamodbResponse<string> = {
        data: ['item1', 'item2', 'item3'],
        cursor: 'next-page-cursor',
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: ['item1', 'item2', 'item3'],
        cursor: 'next-page-cursor',
        hasMore: true,
      });
    });

    it('should normalize response with null cursor (no more pages)', () => {
      const response: DynamodbResponse<number> = {
        data: [1, 2, 3],
        cursor: null,
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: [1, 2, 3],
        cursor: null,
        hasMore: false,
      });
    });

    it('should normalize response with undefined data field', () => {
      const response: DynamodbResponse<string> = {
        cursor: 'next-page-cursor',
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: [],
        cursor: 'next-page-cursor',
        hasMore: true,
      });
    });

    it('should normalize response with undefined cursor field', () => {
      const response: DynamodbResponse<boolean> = {
        data: [true, false],
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: [true, false],
        cursor: null,
        hasMore: false,
      });
    });

    it('should normalize response with both undefined fields', () => {
      const response: DynamodbResponse<object> = {};

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: [],
        cursor: null,
        hasMore: false,
      });
    });

    it('should normalize empty data array', () => {
      const response: DynamodbResponse<string> = {
        data: [],
        cursor: 'next-page-cursor',
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: [],
        cursor: 'next-page-cursor',
        hasMore: true,
      });
    });

    it('should handle empty string cursor as truthy', () => {
      const response: DynamodbResponse<string> = {
        data: ['item1'],
        cursor: '',
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: ['item1'],
        cursor: '',
        hasMore: true,
      });
    });
  });

  describe('Promise responses', () => {
    it('should normalize a Promise<DynamodbResponse>', async () => {
      const responsePromise: Promise<DynamodbResponse<string>> = Promise.resolve({
        data: ['item1', 'item2'],
        cursor: 'next-page-cursor',
      });

      const result = await normalizePaginationResponse(responsePromise);

      expect(result).toStrictEqual({
        data: ['item1', 'item2'],
        cursor: 'next-page-cursor',
        hasMore: true,
      });
    });

    it('should normalize Promise with null cursor', async () => {
      const responsePromise: Promise<DynamodbResponse<number>> = Promise.resolve({
        data: [1, 2, 3],
        cursor: null,
      });

      const result = await normalizePaginationResponse(responsePromise);

      expect(result).toStrictEqual({
        data: [1, 2, 3],
        cursor: null,
        hasMore: false,
      });
    });

    it('should normalize Promise with undefined data', async () => {
      const responsePromise: Promise<DynamodbResponse<string>> = Promise.resolve({
        cursor: 'next-page-cursor',
      });

      const result = await normalizePaginationResponse(responsePromise);

      expect(result).toStrictEqual({
        data: [],
        cursor: 'next-page-cursor',
        hasMore: true,
      });
    });

    it('should normalize Promise with undefined cursor', async () => {
      const responsePromise: Promise<DynamodbResponse<boolean>> = Promise.resolve({
        data: [true, false],
      });

      const result = await normalizePaginationResponse(responsePromise);

      expect(result).toStrictEqual({
        data: [true, false],
        cursor: null,
        hasMore: false,
      });
    });

    it('should handle Promise rejection', async () => {
      const responsePromise: Promise<DynamodbResponse<string>> = Promise.reject(
        new Error('API Error'),
      );

      await expect(normalizePaginationResponse(responsePromise)).rejects.toThrow('API Error');
    });

    it('should handle Promise that resolves to empty object', async () => {
      const responsePromise: Promise<DynamodbResponse<object>> = Promise.resolve({});

      const result = await normalizePaginationResponse(responsePromise);

      expect(result).toStrictEqual({
        data: [],
        cursor: null,
        hasMore: false,
      });
    });
  });

  describe('hasMore calculation', () => {
    it('should set hasMore to true when cursor is a non-empty string', () => {
      const response: DynamodbResponse<string> = {
        data: ['item1'],
        cursor: 'next-page',
      };

      const result = normalizePaginationResponse(response);

      expect(result.hasMore).toBe(true);
    });

    it('should set hasMore to true when cursor is empty string', () => {
      const response: DynamodbResponse<string> = {
        data: ['item1'],
        cursor: '',
      };

      const result = normalizePaginationResponse(response);

      expect(result.hasMore).toBe(true);
    });

    it('should set hasMore to false when cursor is null', () => {
      const response: DynamodbResponse<string> = {
        data: ['item1'],
        cursor: null,
      };

      const result = normalizePaginationResponse(response);

      expect(result.hasMore).toBe(false);
    });

    it('should set hasMore to false when cursor is undefined', () => {
      const response: DynamodbResponse<string> = {
        data: ['item1'],
      };

      const result = normalizePaginationResponse(response);

      expect(result.hasMore).toBe(false);
    });
  });

  describe('Type safety and generics', () => {
    it('should maintain type safety for string arrays', () => {
      const response: DynamodbResponse<string> = {
        data: ['hello', 'world'],
        cursor: 'next',
      };

      const result: PaginationResponse<string> = normalizePaginationResponse(response);

      expect(result.data).toStrictEqual(['hello', 'world']);
      expect(typeof result.data[0]).toBe('string');
    });

    it('should maintain type safety for number arrays', () => {
      const response: DynamodbResponse<number> = {
        data: [1, 2, 3],
        cursor: 'next',
      };

      const result: PaginationResponse<number> = normalizePaginationResponse(response);

      expect(result.data).toStrictEqual([1, 2, 3]);
      expect(typeof result.data[0]).toBe('number');
    });

    it('should maintain type safety for object arrays', () => {
      interface TestObject {
        id: number;
        name: string;
      }

      const response: DynamodbResponse<TestObject> = {
        data: [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' },
        ],
        cursor: 'next',
      };

      const result: PaginationResponse<TestObject> = normalizePaginationResponse(response);

      expect(result.data).toStrictEqual([
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ]);
      expect(typeof result.data[0]).toBe('object');
      expect(result.data[0].id).toBe(1);
      expect(result.data[0].name).toBe('test1');
    });

    it('should maintain type safety with Promise responses', async () => {
      interface User {
        id: number;
        email: string;
      }

      const responsePromise: Promise<DynamodbResponse<User>> = Promise.resolve({
        data: [{ id: 1, email: 'user@example.com' }],
        cursor: 'next',
      });

      const result: PaginationResponse<User> = await normalizePaginationResponse(responsePromise);

      expect(result.data).toStrictEqual([{ id: 1, email: 'user@example.com' }]);
      expect(result.data[0].id).toBe(1);
      expect(result.data[0].email).toBe('user@example.com');
    });
  });

  describe('Edge cases', () => {
    it('should handle response with null data', () => {
      const response: DynamodbResponse<string> = {
        // @ts-expect-error - test case for null data
        data: null,
        cursor: 'next',
      };

      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: [],
        cursor: 'next',
        hasMore: true,
      });
    });

    it('should handle complex nested objects', () => {
      interface ComplexObject {
        id: number;
        metadata: {
          tags: string[];
          created: Date;
        };
      }

      const response: DynamodbResponse<ComplexObject> = {
        data: [
          {
            id: 1,
            metadata: {
              tags: ['tag1', 'tag2'],
              created: new Date('2023-01-01'),
            },
          },
        ],
        cursor: 'next',
      };

      const result = normalizePaginationResponse(response);

      expect(result.data).toStrictEqual([
        {
          id: 1,
          metadata: {
            tags: ['tag1', 'tag2'],
            created: new Date('2023-01-01'),
          },
        },
      ]);
      expect(result.hasMore).toBe(true);
    });

    it('should handle very large arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const response: DynamodbResponse<string> = {
        data: largeArray,
        cursor: 'next',
      };

      const result = normalizePaginationResponse(response);

      expect(result.data).toStrictEqual(largeArray);
      expect(result.data).toHaveLength(1000);
      expect(result.hasMore).toBe(true);
    });

    it('should handle special cursor values', () => {
      const specialCursors = ['0', 'false', 'true', 'null', 'undefined'];

      specialCursors.forEach((cursor) => {
        const response: DynamodbResponse<string> = {
          data: ['item'],
          cursor,
        };

        const result = normalizePaginationResponse(response);

        expect(result.cursor).toBe(cursor);
        expect(result.hasMore).toBe(true);
      });
    });
  });

  describe('Function overloads', () => {
    it('should correctly infer return type for synchronous response', () => {
      const response: DynamodbResponse<string> = {
        data: ['test'],
        cursor: 'next',
      };

      // This should be inferred as PaginationResponse<string>, not Promise<PaginationResponse<string>>
      const result = normalizePaginationResponse(response);

      expect(result).toStrictEqual({
        data: ['test'],
        cursor: 'next',
        hasMore: true,
      });
      expect(result).not.toBeInstanceOf(Promise);
    });

    it('should correctly infer return type for Promise response', async () => {
      const responsePromise: Promise<DynamodbResponse<string>> = Promise.resolve({
        data: ['test'],
        cursor: 'next',
      });

      // This should be inferred as Promise<PaginationResponse<string>>
      const result = normalizePaginationResponse(responsePromise);

      expect(result).toBeInstanceOf(Promise);

      const resolved = await result;
      expect(resolved).toStrictEqual({
        data: ['test'],
        cursor: 'next',
        hasMore: true,
      });
    });
  });
});
