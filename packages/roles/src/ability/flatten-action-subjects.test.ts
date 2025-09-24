import { describe, it, expect } from '@jest/globals';

import { Action, Permission, permission, Subject } from '../permissions';

import { flattenActionSubjects } from './flatten-action-subjects';

describe('flattenActionSubjects', () => {
  it('should return a single permission when action and subject are single values', () => {
    const inputPermission: Permission = permission({
      subject: 'user',
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(1);
    expect(result[0]).toStrictEqual({
      subject: 'user',
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });
  });

  it('should flatten multiple actions with single subject', () => {
    const inputPermission: Permission = permission({
      subject: 'user',
      action: ['read', 'create'],
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(2);
    expect(result[0]).toStrictEqual({
      subject: 'user',
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });
    expect(result[1]).toStrictEqual({
      subject: 'user',
      action: 'create',
      type: 'can',
      scope: 'app:123',
    });
  });

  it('should flatten single action with multiple subjects', () => {
    const inputPermission: Permission = permission({
      subject: ['user', 'role'],
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(2);
    expect(result[0]).toStrictEqual({
      subject: 'user',
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });
    expect(result[1]).toStrictEqual({
      subject: 'role',
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });
  });

  it('should flatten multiple actions with multiple subjects', () => {
    const inputPermission: Permission = permission({
      subject: ['user', 'role'],
      action: ['read', 'create'],
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(4);
    expect(result).toStrictEqual([
      {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'app:123',
      },
      {
        subject: 'user',
        action: 'create',
        type: 'can',
        scope: 'app:123',
      },
      {
        subject: 'role',
        action: 'read',
        type: 'can',
        scope: 'app:123',
      },
      {
        subject: 'role',
        action: 'create',
        type: 'can',
        scope: 'app:123',
      },
    ]);
  });

  it('should preserve all other permission properties', () => {
    const inputPermission: Permission = permission({
      subject: ['user', 'role'],
      action: ['read', 'create'],
      type: 'cannot',
      scope: 'org:456',
      conditions: { userId: '123' },
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(4);
    result.forEach((perm) => {
      expect(perm.type).toBe('cannot');
      expect(perm.scope).toBe('org:456');
      expect(perm.conditions).toStrictEqual({ userId: '123' });
    });
  });

  it('should handle empty arrays gracefully', () => {
    const inputPermission: Permission = permission({
      subject: [],
      action: [],
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(0);
  });

  it('should handle single empty array for action', () => {
    const inputPermission: Permission = permission({
      subject: 'user',
      action: [],
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(0);
  });

  it('should handle single empty array for subject', () => {
    const inputPermission: Permission = permission({
      subject: [] as Subject[],
      action: 'read',
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(0);
  });

  it('should handle large arrays efficiently', () => {
    const actions = Array.from({ length: 10 }, (_, i) => `action${String(i)}`) as Action[];
    const subjects = Array.from({ length: 10 }, (_, i) => `subject${String(i)}`) as Subject[];

    const inputPermission: Permission = permission({
      subject: subjects,
      action: actions,
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    expect(result).toHaveLength(100); // 10 * 10
  });

  it('should not mutate the original permission object', () => {
    const inputPermission: Permission = permission({
      subject: ['user', 'role'],
      action: ['read', 'create'],
      type: 'can',
      scope: 'app:123',
    });

    const originalPermission = { ...inputPermission };
    flattenActionSubjects(inputPermission);

    expect(inputPermission).toStrictEqual(originalPermission);
  });

  it('should create new objects for each flattened permission', () => {
    const inputPermission: Permission = permission({
      subject: ['user', 'role'],
      action: ['read', 'create'],
      type: 'can',
      scope: 'app:123',
    });

    const result = flattenActionSubjects(inputPermission);

    // Each result should be a new object
    result.forEach((perm, index) => {
      result.forEach((otherPerm, otherIndex) => {
        if (index !== otherIndex) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(perm).not.toBe(otherPerm);
        }
      });
    });
  });
});
