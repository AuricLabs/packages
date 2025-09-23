import { parseScope } from './parse-scope';
import { Scope } from './types';

describe('parseScope', () => {
  describe('should return empty array for falsy scopes', () => {
    it('should return empty array for undefined scope', () => {
      expect(parseScope(undefined)).toStrictEqual([]);
    });

    it('should return empty array for null scope', () => {
      expect(parseScope(null as unknown as Scope)).toStrictEqual([]);
    });

    it('should return empty array for empty string scope', () => {
      expect(parseScope('')).toStrictEqual([]);
    });

    it('should return empty array for empty array scope', () => {
      expect(parseScope([])).toStrictEqual([]);
    });
  });

  describe('should return scope as-is for ScopeSubject arrays', () => {
    it('should return single scope subject unchanged', () => {
      const scopeSubject: Scope = [{ type: 'org' }];
      expect(parseScope(scopeSubject)).toStrictEqual(scopeSubject);
    });

    it('should return scope subject with id unchanged', () => {
      const scopeSubject: Scope = [{ type: 'org', id: '123' }];
      expect(parseScope(scopeSubject)).toStrictEqual(scopeSubject);
    });

    it('should return multiple scope subjects unchanged', () => {
      const scopeSubject: Scope = [
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ];
      expect(parseScope(scopeSubject)).toStrictEqual(scopeSubject);
    });

    it('should return mixed scope subjects unchanged', () => {
      const scopeSubject: Scope = [{ type: 'org' }, { type: 'app', id: 'myapp' }];
      expect(parseScope(scopeSubject)).toStrictEqual(scopeSubject);
    });
  });

  describe('should parse string scopes correctly', () => {
    it('should parse single type scope', () => {
      expect(parseScope('org')).toStrictEqual([{ type: 'org', id: undefined }]);
    });

    it('should parse type with id scope', () => {
      expect(parseScope('org:123')).toStrictEqual([{ type: 'org', id: '123' }]);
    });

    it('should parse multiple type-id pairs', () => {
      expect(parseScope('org:123:app:myapp')).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ]);
    });

    it('should parse type with empty id', () => {
      expect(parseScope('org:')).toStrictEqual([{ type: 'org', id: undefined }]);
    });

    it('should parse complex nested scope', () => {
      expect(parseScope('org:123:app:myapp:feature:subfeature')).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
        { type: 'feature', id: 'subfeature' },
      ]);
    });

    it('should convert to lowercase', () => {
      // @ts-expect-error test for uppercase
      expect(parseScope('ORG:123:APP:MYAPP')).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ]);
    });
  });

  describe('should parse string array scopes correctly', () => {
    it('should parse single type scope array', () => {
      expect(parseScope(['org'])).toStrictEqual([{ type: 'org', id: undefined }]);
    });

    it('should parse type with id scope array', () => {
      expect(parseScope(['org', '123'])).toStrictEqual([{ type: 'org', id: '123' }]);
    });

    it('should parse multiple type-id pairs array', () => {
      expect(parseScope(['org', '123', 'app', 'myapp'])).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ]);
    });

    it('should parse type with empty id array', () => {
      expect(parseScope(['org', ''])).toStrictEqual([{ type: 'org', id: undefined }]);
    });

    it('should parse complex nested scope array', () => {
      expect(parseScope(['org', '123', 'app', 'myapp', 'feature', 'subfeature'])).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
        { type: 'feature', id: 'subfeature' },
      ]);
    });

    it('should convert to lowercase', () => {
      // @ts-expect-error test for uppercase
      expect(parseScope(['ORG', '123', 'APP', 'MYAPP'])).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ]);
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle odd number of segments in string', () => {
      expect(parseScope('org:123:app')).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: undefined },
      ]);
    });

    it('should handle odd number of segments in array', () => {
      // @ts-expect-error test for mixed array types
      expect(parseScope(['org', '123', 'app'])).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: undefined },
      ]);
    });

    it('should handle empty segments in string', () => {
      expect(parseScope('org::app:myapp')).toStrictEqual([
        { type: 'org', id: undefined },
        { type: 'app', id: 'myapp' },
      ]);
    });

    it('should handle empty segments in array', () => {
      expect(parseScope(['org', '', 'app', 'myapp'])).toStrictEqual([
        { type: 'org', id: undefined },
        { type: 'app', id: 'myapp' },
      ]);
    });

    it('should handle whitespace in string', () => {
      // @ts-expect-error test for whitespace
      expect(parseScope(' org : 123 ')).toStrictEqual([{ type: 'org', id: '123' }]);
    });

    it('should handle whitespace in array', () => {
      // @ts-expect-error test for whitespace
      expect(parseScope([' org ', ' 123 '])).toStrictEqual([{ type: 'org', id: '123' }]);
    });
  });

  describe('should throw error for unsupported scope types', () => {
    it('should throw error for mixed array types', () => {
      // @ts-expect-error test for mixed array types
      expect(() => parseScope(['org', 123])).toThrow(
        'Unsupported scope type object\n["org",123]. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should throw error for number scope', () => {
      // @ts-expect-error test for number scope
      expect(() => parseScope(123)).toThrow(
        'Unsupported scope type number\n123. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should throw error for boolean scope', () => {
      // @ts-expect-error test for boolean scope
      expect(() => parseScope(true)).toThrow(
        'Unsupported scope type boolean\ntrue. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should throw error for object scope', () => {
      // @ts-expect-error test for object scope
      expect(() => parseScope({ type: 'org' })).toThrow(
        'Unsupported scope type object\n{"type":"org"}. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should throw error for function scope', () => {
      const func = () => 'org:123';
      // @ts-expect-error test for function scope
      expect(() => parseScope(func)).toThrow(
        'Unsupported scope type function\nundefined. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });
  });

  describe('type safety', () => {
    it('should accept all valid Scope types', () => {
      // These should compile without TypeScript errors
      const stringScope: Scope = 'org:123';
      const arrayScope: Scope = ['org', '123'];
      const subjectScope: Scope = [{ type: 'org', id: '123' }];

      expect(Array.isArray(parseScope(stringScope))).toBe(true);
      expect(Array.isArray(parseScope(arrayScope))).toBe(true);
      expect(Array.isArray(parseScope(subjectScope))).toBe(true);
    });

    it('should return ScopeSubjectArray type', () => {
      const result = parseScope('org:123');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result[0].type).toBe('string');
      expect(result[0].id).toBeDefined();
    });
  });
});
