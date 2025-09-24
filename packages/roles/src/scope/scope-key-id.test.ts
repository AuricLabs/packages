import { describe, it, expect } from '@jest/globals';

import { scopeKeyId } from './scope-key-id';

describe('scopeKeyId', () => {
  describe('should convert simple keys correctly', () => {
    it('should convert single word key', () => {
      expect(scopeKeyId('org')).toBe('orgId');
    });

    it('should convert single word key with underscore', () => {
      expect(scopeKeyId('user_profile')).toBe('userProfileId');
    });

    it('should convert single word key with hyphens', () => {
      expect(scopeKeyId('user-profile')).toBe('userProfileId');
    });

    it('should convert single word key with spaces', () => {
      expect(scopeKeyId('user profile')).toBe('userProfileId');
    });
  });

  describe('should handle multi-word keys correctly', () => {
    it('should convert camelCase key', () => {
      expect(scopeKeyId('userProfile')).toBe('userProfileId');
    });

    it('should convert PascalCase key', () => {
      expect(scopeKeyId('UserProfile')).toBe('userProfileId');
    });

    it('should convert snake_case key', () => {
      expect(scopeKeyId('user_profile')).toBe('userProfileId');
    });

    it('should convert kebab-case key', () => {
      expect(scopeKeyId('user-profile')).toBe('userProfileId');
    });

    it('should convert space separated key', () => {
      expect(scopeKeyId('user profile')).toBe('userProfileId');
    });

    it('should convert mixed case key', () => {
      expect(scopeKeyId('User_Profile-Info')).toBe('userProfileInfoId');
    });
  });

  describe('should handle special characters correctly', () => {
    it('should handle multiple underscores', () => {
      expect(scopeKeyId('user__profile')).toBe('userProfileId');
    });

    it('should handle multiple hyphens', () => {
      expect(scopeKeyId('user--profile')).toBe('userProfileId');
    });

    it('should handle multiple spaces', () => {
      expect(scopeKeyId('user  profile')).toBe('userProfileId');
    });

    it('should handle mixed separators', () => {
      expect(scopeKeyId('user_profile-info')).toBe('userProfileInfoId');
    });

    it('should handle leading separators', () => {
      expect(scopeKeyId('_user_profile')).toBe('userProfileId');
    });

    it('should handle trailing separators', () => {
      expect(scopeKeyId('user_profile_')).toBe('userProfileId');
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle empty string', () => {
      expect(scopeKeyId('')).toBe('id');
    });

    it('should handle single character', () => {
      expect(scopeKeyId('a')).toBe('aId');
    });

    it('should handle numbers', () => {
      expect(scopeKeyId('123')).toBe('123Id');
    });

    it('should handle alphanumeric', () => {
      expect(scopeKeyId('user123')).toBe('user123Id');
    });

    it('should handle special characters', () => {
      expect(scopeKeyId('user@profile')).toBe('userProfileId');
    });

    it('should handle unicode characters', () => {
      expect(scopeKeyId('userñprofile')).toBe('usernprofileId');
    });
  });

  describe('should handle complex scenarios', () => {
    it('should handle very long key', () => {
      const longKey = 'very_long_key_name_with_many_underscores_and_hyphens';
      expect(scopeKeyId(longKey)).toBe('veryLongKeyNameWithManyUnderscoresAndHyphensId');
    });

    it('should handle key with numbers mixed in', () => {
      expect(scopeKeyId('user123_profile')).toBe('user123ProfileId');
    });

    it('should handle key with consecutive uppercase letters', () => {
      expect(scopeKeyId('USER_PROFILE')).toBe('userProfileId');
    });

    it('should handle key with acronyms', () => {
      expect(scopeKeyId('user_id_profile')).toBe('userIdProfileId');
    });

    it('should handle key with mixed separators and cases', () => {
      expect(scopeKeyId('User_Profile-Info_Data')).toBe('userProfileInfoDataId');
    });
  });

  describe('should maintain type safety', () => {
    it('should return correct template literal type', () => {
      const result = scopeKeyId('org');
      expect(typeof result).toBe('string');
      expect(result).toBe('orgId');
    });

    it('should work with const assertions', () => {
      const key = 'user_profile' as const;
      const result = scopeKeyId(key);
      expect(result).toBe('userProfileId');
    });

    it('should work with string literals', () => {
      const appKey = 'app' as const;
      const result = scopeKeyId(appKey);
      expect(result).toBe('appId');
    });
  });

  describe('should handle common scope types', () => {
    it('should handle org scope', () => {
      expect(scopeKeyId('org')).toBe('orgId');
    });

    it('should handle app scope', () => {
      expect(scopeKeyId('app')).toBe('appId');
    });

    it('should handle system scope', () => {
      expect(scopeKeyId('system')).toBe('systemId');
    });

    it('should handle feature scope', () => {
      expect(scopeKeyId('feature')).toBe('featureId');
    });

    it('should handle user scope', () => {
      expect(scopeKeyId('user')).toBe('userId');
    });

    it('should handle role scope', () => {
      expect(scopeKeyId('role')).toBe('roleId');
    });

    it('should handle permission scope', () => {
      expect(scopeKeyId('permission')).toBe('permissionId');
    });
  });

  describe('should handle lodash camelCase edge cases', () => {
    it('should handle single uppercase letter', () => {
      expect(scopeKeyId('A')).toBe('aId');
    });

    it('should handle all uppercase', () => {
      expect(scopeKeyId('USER_PROFILE')).toBe('userProfileId');
    });

    it('should handle camelCase input', () => {
      expect(scopeKeyId('userProfile')).toBe('userProfileId');
    });

    it('should handle PascalCase input', () => {
      expect(scopeKeyId('UserProfile')).toBe('userProfileId');
    });

    it('should handle mixed separators consistently', () => {
      expect(scopeKeyId('user_profile')).toBe('userProfileId');
      expect(scopeKeyId('user-profile')).toBe('userProfileId');
      expect(scopeKeyId('user profile')).toBe('userProfileId');
    });
  });
});
