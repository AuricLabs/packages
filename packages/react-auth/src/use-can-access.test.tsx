import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthPermissionsProvider } from './auth-permissions-provider';
import { useCanAccess } from './use-can-access';

import type { ReactNode } from 'react';

function createWrapper(permissions: string[] = [], isLoading = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthPermissionsProvider permissions={permissions} isLoading={isLoading}>
        {children}
      </AuthPermissionsProvider>
    );
  };
}

describe('useCanAccess', () => {
  describe('requireAll', () => {
    it('returns canAccess=true when user has all required permissions', () => {
      const { result } = renderHook(
        () => useCanAccess({ requireAll: ['agent:read', 'agent:create'] }),
        {
          wrapper: createWrapper(['agent:manage']),
        },
      );

      expect(result.current.canAccess).toBe(true);
      expect(result.current.canAccessAll).toBe(true);
    });

    it('returns canAccess=false when user is missing a required permission', () => {
      const { result } = renderHook(
        () => useCanAccess({ requireAll: ['agent:read', 'billing:manage'] }),
        {
          wrapper: createWrapper(['agent:read']),
        },
      );

      expect(result.current.canAccess).toBe(false);
      expect(result.current.canAccessAll).toBe(false);
    });

    it('treats empty requireAll as no requirement', () => {
      const { result } = renderHook(() => useCanAccess({ requireAll: [] }), {
        wrapper: createWrapper([]),
      });

      expect(result.current.canAccessAll).toBe(true);
      expect(result.current.canAccess).toBe(true);
    });
  });

  describe('requireAny', () => {
    it('returns canAccess=true when user has any of the permissions', () => {
      const { result } = renderHook(
        () => useCanAccess({ requireAny: ['agent:read', 'billing:manage'] }),
        {
          wrapper: createWrapper(['agent:read']),
        },
      );

      expect(result.current.canAccess).toBe(true);
      expect(result.current.canAccessAny).toBe(true);
    });

    it('returns canAccess=false when user has none of the permissions', () => {
      const { result } = renderHook(
        () => useCanAccess({ requireAny: ['billing:manage', 'billing:read'] }),
        {
          wrapper: createWrapper(['agent:read']),
        },
      );

      expect(result.current.canAccess).toBe(false);
      expect(result.current.canAccessAny).toBe(false);
    });

    it('treats empty requireAny as no requirement', () => {
      const { result } = renderHook(() => useCanAccess({ requireAny: [] }), {
        wrapper: createWrapper([]),
      });

      expect(result.current.canAccessAny).toBe(true);
      expect(result.current.canAccess).toBe(true);
    });
  });

  describe('combined requireAll + requireAny', () => {
    it('returns canAccess=true when both are satisfied', () => {
      const { result } = renderHook(
        () =>
          useCanAccess({
            requireAll: ['agent:read'],
            requireAny: ['billing:manage', 'billing:read'],
          }),
        { wrapper: createWrapper(['agent:read', 'billing:read']) },
      );

      expect(result.current.canAccess).toBe(true);
      expect(result.current.canAccessAll).toBe(true);
      expect(result.current.canAccessAny).toBe(true);
    });

    it('returns canAccess=false when requireAll fails but requireAny passes', () => {
      const { result } = renderHook(
        () =>
          useCanAccess({
            requireAll: ['agent:read', 'agent:create'],
            requireAny: ['billing:manage'],
          }),
        { wrapper: createWrapper(['agent:read', 'billing:manage']) },
      );

      expect(result.current.canAccess).toBe(false);
      expect(result.current.canAccessAll).toBe(false);
      expect(result.current.canAccessAny).toBe(true);
    });

    it('returns canAccess=false when requireAny fails but requireAll passes', () => {
      const { result } = renderHook(
        () =>
          useCanAccess({
            requireAll: ['agent:read'],
            requireAny: ['billing:manage', 'billing:read'],
          }),
        { wrapper: createWrapper(['agent:read']) },
      );

      expect(result.current.canAccess).toBe(false);
      expect(result.current.canAccessAll).toBe(true);
      expect(result.current.canAccessAny).toBe(false);
    });

    it('returns canAccess=false when both fail', () => {
      const { result } = renderHook(
        () =>
          useCanAccess({
            requireAll: ['agent:create'],
            requireAny: ['billing:manage'],
          }),
        { wrapper: createWrapper(['agent:read']) },
      );

      expect(result.current.canAccess).toBe(false);
      expect(result.current.canAccessAll).toBe(false);
      expect(result.current.canAccessAny).toBe(false);
    });
  });

  describe('loading state', () => {
    it('returns all false with isLoading=true while loading', () => {
      const { result } = renderHook(() => useCanAccess({ requireAll: ['agent:read'] }), {
        wrapper: createWrapper(['agent:read'], true),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.canAccess).toBe(false);
      expect(result.current.canAccessAll).toBe(false);
      expect(result.current.canAccessAny).toBe(false);
    });
  });

  describe('no requirements', () => {
    it('returns canAccess=true when no requirements specified', () => {
      const { result } = renderHook(() => useCanAccess({}), {
        wrapper: createWrapper([]),
      });

      expect(result.current.canAccess).toBe(true);
      expect(result.current.canAccessAll).toBe(true);
      expect(result.current.canAccessAny).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
