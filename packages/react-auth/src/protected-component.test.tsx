import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthPermissionsProvider } from './auth-permissions-provider';
import { ProtectedComponent } from './protected-component';

import type { ReactNode } from 'react';

function renderProtected(props: {
  permissions: string[];
  isLoading?: boolean;
  requireAll?: string[];
  requireAny?: string[];
  fallback?: ReactNode;
  loading?: ReactNode;
  children?: ReactNode;
}) {
  const {
    permissions,
    isLoading = false,
    children = <span data-testid="content">protected content</span>,
    ...rest
  } = props;
  return render(
    <AuthPermissionsProvider permissions={permissions} isLoading={isLoading}>
      <ProtectedComponent {...rest}>{children}</ProtectedComponent>
    </AuthPermissionsProvider>,
  );
}

describe('ProtectedComponent', () => {
  it('renders children when access is granted', () => {
    renderProtected({
      permissions: ['agent:manage'],
      requireAll: ['agent:read'],
    });
    expect(screen.getByTestId('content')).toHaveTextContent('protected content');
  });

  it('renders fallback when access is denied', () => {
    renderProtected({
      permissions: [],
      requireAll: ['agent:read'],
      fallback: <span data-testid="fallback">no access</span>,
    });
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback')).toHaveTextContent('no access');
  });

  it('renders nothing when access is denied and no fallback', () => {
    const { container } = renderProtected({
      permissions: [],
      requireAll: ['agent:read'],
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders loading slot while isLoading is true', () => {
    renderProtected({
      permissions: ['agent:read'],
      isLoading: true,
      requireAll: ['agent:read'],
      loading: <span data-testid="loading">loading...</span>,
    });
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('loading')).toHaveTextContent('loading...');
  });

  it('renders nothing when loading and no loading slot', () => {
    const { container } = renderProtected({
      permissions: ['agent:read'],
      isLoading: true,
      requireAll: ['agent:read'],
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders children with requireAny when user has one matching permission', () => {
    renderProtected({
      permissions: ['billing:read'],
      requireAny: ['billing:read', 'billing:manage'],
    });
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders fallback with requireAny when user has no matching permission', () => {
    renderProtected({
      permissions: ['agent:read'],
      requireAny: ['billing:read', 'billing:manage'],
      fallback: <span data-testid="fallback">denied</span>,
    });
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback')).toHaveTextContent('denied');
  });

  it('renders children with combined requireAll and requireAny', () => {
    renderProtected({
      permissions: ['agent:read', 'billing:manage'],
      requireAll: ['agent:read'],
      requireAny: ['billing:read', 'billing:manage'],
    });
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders fallback when combined permissions partially fail', () => {
    renderProtected({
      permissions: ['agent:read'],
      requireAll: ['agent:read'],
      requireAny: ['billing:read', 'billing:manage'],
      fallback: <span data-testid="fallback">denied</span>,
    });
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback')).toHaveTextContent('denied');
  });

  it('renders children when no requirements are specified', () => {
    renderProtected({
      permissions: [],
    });
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('re-renders on permission changes', () => {
    const { rerender } = render(
      <AuthPermissionsProvider permissions={[]}>
        <ProtectedComponent
          requireAll={['agent:read']}
          fallback={<span data-testid="fallback">denied</span>}
        >
          <span data-testid="content">protected content</span>
        </ProtectedComponent>
      </AuthPermissionsProvider>,
    );

    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();

    rerender(
      <AuthPermissionsProvider permissions={['agent:read']}>
        <ProtectedComponent
          requireAll={['agent:read']}
          fallback={<span data-testid="fallback">denied</span>}
        >
          <span data-testid="content">protected content</span>
        </ProtectedComponent>
      </AuthPermissionsProvider>,
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).toBeNull();
  });
});
