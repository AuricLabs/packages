import { isGlobalScope } from './is-global-scope';
import { Scope } from './types';

describe('isGlobalScope', () => {
  describe('should return true for global scopes', () => {
    it('should return true for undefined scope', () => {
      expect(isGlobalScope(undefined)).toBe(true);
    });

    it('should return true for null scope', () => {
      expect(isGlobalScope(null as unknown as Scope)).toBe(true);
    });

    it('should return true for empty string scope', () => {
      expect(isGlobalScope('')).toBe(true);
    });

    it('should return true for empty array scope', () => {
      expect(isGlobalScope([])).toBe(true);
    });

    it('should return false for system scope', () => {
      expect(isGlobalScope('system')).toBe(false);
    });

    it('should return false for system scope as array', () => {
      expect(isGlobalScope(['system'])).toBe(false);
    });

    it('should return true for empty scope subject array', () => {
      expect(isGlobalScope([])).toBe(true);
    });
  });

  describe('should return false for non-global scopes', () => {
    it('should return false for org scope', () => {
      expect(isGlobalScope('org')).toBe(false);
    });

    it('should return false for org scope as array', () => {
      expect(isGlobalScope(['org'])).toBe(false);
    });

    it('should return false for org with specific ID', () => {
      expect(isGlobalScope('org:123')).toBe(false);
    });

    it('should return false for org with specific ID as array', () => {
      expect(isGlobalScope(['org', '123'])).toBe(false);
    });

    it('should return false for app scope', () => {
      expect(isGlobalScope('app:myapp')).toBe(false);
    });

    it('should return false for app scope as array', () => {
      expect(isGlobalScope(['app', 'myapp'])).toBe(false);
    });

    it('should return false for app with multiple segments', () => {
      expect(isGlobalScope('app:myapp:feature')).toBe(false);
    });

    it('should return false for app with multiple segments as array', () => {
      expect(isGlobalScope(['app', 'myapp', 'feature'])).toBe(false);
    });

    it('should return false for org with app scope', () => {
      expect(isGlobalScope('org:123:app:myapp')).toBe(false);
    });

    it('should return false for org with app scope as array', () => {
      expect(isGlobalScope(['org', '123', 'app', 'myapp'])).toBe(false);
    });

    it('should return false for scope subject with type', () => {
      const scopeSubject: Scope = [{ type: 'org' }];
      expect(isGlobalScope(scopeSubject)).toBe(false);
    });

    it('should return false for scope subject with type and id', () => {
      const scopeSubject: Scope = [{ type: 'org', id: '123' }];
      expect(isGlobalScope(scopeSubject)).toBe(false);
    });

    it('should return false for multiple scope subjects', () => {
      const scopeSubject: Scope = [
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ];
      expect(isGlobalScope(scopeSubject)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle mixed case scope strings', () => {
      // @ts-expect-error test for uppercase
      expect(isGlobalScope('ORG:123')).toBe(false);
      // @ts-expect-error test for uppercase
      expect(isGlobalScope('App:MyApp')).toBe(false);
    });

    it('should handle scope strings with extra colons', () => {
      expect(() => isGlobalScope('org:123:')).toThrow(
        'Invalid scope string array: ["org","123",""]. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
      // @ts-expect-error test for empty string
      expect(() => isGlobalScope(':org:123')).toThrow(
        'Invalid scope string array: ["","org","123"]. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should handle complex nested scopes', () => {
      expect(isGlobalScope('org:123:app:myapp:feature:subfeature')).toBe(false);
    });

    it('should handle scope arrays with empty strings', () => {
      expect(isGlobalScope(['org', '', 'app', 'myapp'])).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should accept all valid Scope types', () => {
      // These should compile without TypeScript errors
      const stringScope: Scope = 'org:123';
      const arrayScope: Scope = ['org', '123'];
      const subjectScope: Scope = [{ type: 'org', id: '123' }];

      expect(typeof isGlobalScope(stringScope)).toBe('boolean');
      expect(typeof isGlobalScope(arrayScope)).toBe('boolean');
      expect(typeof isGlobalScope(subjectScope)).toBe('boolean');
    });
  });
});
