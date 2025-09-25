import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import {
  createPaginationQuerySchema,
  paginationConfigDto,
  type PaginationDtoSchemaConfig,
} from './pagination-config.dto';

describe('createPaginationQuerySchema', () => {
  describe('with default configuration', () => {
    const schema = createPaginationQuerySchema();

    it('should accept valid pagination parameters', () => {
      const result = schema.safeParse({
        cursor: 'next-page-token',
        limit: '50',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'next-page-token',
        limit: 50,
      });
    });

    it('should handle missing cursor', () => {
      const result = schema.safeParse({
        limit: '25',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        limit: 25,
      });
    });

    it('should handle empty cursor string', () => {
      const result = schema.safeParse({
        cursor: '',
        limit: '30',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: undefined,
        limit: 30,
      });
    });

    it('should handle missing limit', () => {
      expect(() => {
        schema.parse({
          cursor: 'some-cursor',
        });
      }).not.toThrow();
    });

    it('should have default limit when no limit is specified', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(10); // Default limit is 10
      expect(result.data?.cursor).toBe('some-cursor');
    });

    it('should reject limit below minimum (1)', () => {
      expect(() => {
        schema.parse({
          limit: '0',
        });
      }).toThrow('Too small');
    });

    it('should reject limit above default maximum (100)', () => {
      expect(() => {
        schema.parse({
          limit: '1500',
        });
      }).toThrow('Too big');
    });

    it('should reject non-integer limits', () => {
      expect(() => {
        schema.parse({
          limit: '25.5',
        });
      }).toThrow('Invalid input');
    });

    it('should reject non-numeric limits', () => {
      expect(() => {
        schema.parse({
          limit: 'invalid',
        });
      }).toThrow('Invalid input');
    });
  });

  describe('with custom default limit', () => {
    const config: PaginationDtoSchemaConfig = {
      defaultLimit: 25,
    };
    const schema = createPaginationQuerySchema(config);

    it('should use default limit when limit is not provided', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'some-cursor',
        limit: 25,
      });
    });

    it('should still accept explicit limit values', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
        limit: '50',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'some-cursor',
        limit: 50,
      });
    });
  });

  describe('with custom min/max limits', () => {
    const config: PaginationDtoSchemaConfig = {
      minLimit: 5,
      maxLimit: 100,
    };
    const schema = createPaginationQuerySchema(config);

    it('should accept limits within custom range', () => {
      const result = schema.safeParse({
        limit: '50',
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it('should reject limit below custom minimum', () => {
      expect(() => {
        schema.parse({
          limit: '3',
        });
      }).toThrow('Too small');
    });

    it('should reject limit above custom maximum', () => {
      expect(() => {
        schema.parse({
          limit: '150',
        });
      }).toThrow('Too big');
    });

    it('should default to defaultLimit when no limit is provided', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'some-cursor',
        limit: 10, // Should default to defaultLimit (10)
      });
    });
  });

  describe('with all custom configuration', () => {
    const config: PaginationDtoSchemaConfig = {
      defaultLimit: 20,
      minLimit: 1,
      maxLimit: 50,
    };
    const schema = createPaginationQuerySchema(config);

    it('should use all custom values', () => {
      const result = schema.safeParse({});

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        limit: 20,
      });
    });

    it('should validate against custom min/max', () => {
      const result = schema.safeParse({
        limit: '25',
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(25);
    });
  });

  describe('with zero defaultLimit', () => {
    const config: PaginationDtoSchemaConfig = {
      defaultLimit: 0,
    };
    const schema = createPaginationQuerySchema(config);

    it('should have undefined limit when no limit is specified and defaultLimit is 0', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'some-cursor',
      });
    });

    it('should still accept explicit limit values', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
        limit: '25',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'some-cursor',
        limit: 25,
      });
    });
  });

  describe('with zero maxLimit', () => {
    const config: PaginationDtoSchemaConfig = {
      maxLimit: 0,
    };
    const schema = createPaginationQuerySchema(config);

    it('should accept any positive integer when maxLimit is 0', () => {
      const result = schema.safeParse({
        limit: '1500',
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(1500);
    });

    it('should accept very large numbers when maxLimit is 0', () => {
      const result = schema.safeParse({
        limit: '999999',
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(999999);
    });

    it('should still reject limits below minimum', () => {
      expect(() => {
        schema.parse({
          limit: '0',
        });
      }).toThrow('Too small');
    });
  });

  describe('with both zero defaultLimit and zero maxLimit', () => {
    const config: PaginationDtoSchemaConfig = {
      defaultLimit: 0,
      maxLimit: 0,
    };
    const schema = createPaginationQuerySchema(config);

    it('should have undefined limit when no limit is specified', () => {
      const result = schema.safeParse({
        cursor: 'some-cursor',
      });

      expect(result.success).toBe(true);
      expect(result.data).toStrictEqual({
        cursor: 'some-cursor',
      });
    });

    it('should accept any positive integer', () => {
      const result = schema.safeParse({
        limit: '999999',
      });

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(999999);
    });
  });

  describe('edge cases', () => {
    const schema = createPaginationQuerySchema();

    it('should handle zero as limit', () => {
      expect(() => {
        schema.parse({
          limit: '0',
        });
      }).toThrow('Too small');
    });

    it('should handle negative limits', () => {
      expect(() => {
        schema.parse({
          limit: '-10',
        });
      }).toThrow('Too small');
    });

    it('should reject very large numbers above default maximum', () => {
      expect(() => {
        schema.parse({
          limit: '999999',
        });
      }).toThrow('Too big');
    });

    it('should handle whitespace in cursor', () => {
      const result = schema.safeParse({
        cursor: '  whitespace  ',
        limit: '25',
      });

      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe('  whitespace  ');
    });
  });
});

describe('paginationConfigDto', () => {
  it('should be a valid Zod schema', () => {
    expect(paginationConfigDto).toBeInstanceOf(z.ZodObject);
  });

  it('should have the expected shape', () => {
    const shape = paginationConfigDto.shape;
    expect(shape).toHaveProperty('cursor');
    expect(shape).toHaveProperty('limit');
  });

  it('should work with default configuration', () => {
    const result = paginationConfigDto.safeParse({
      cursor: 'test-cursor',
      limit: '100',
    });

    expect(result.success).toBe(true);
    expect(result.data).toStrictEqual({
      cursor: 'test-cursor',
      limit: 100,
    });
  });
});
