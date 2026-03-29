import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthPermissionsProvider } from './auth-permissions-provider';
import { usePermissions } from './use-permissions';

function PermissionsInspector() {
  const { ability, isLoading } = usePermissions();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="has-manage">{String(ability.has('agent:manage'))}</span>
      <span data-testid="has-read">{String(ability.has('agent:read'))}</span>
    </div>
  );
}

describe('AuthPermissionsProvider', () => {
  it('renders children', () => {
    render(
      <AuthPermissionsProvider permissions={[]}>
        <span data-testid="child">hello</span>
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });

  it('creates ability from the given permissions', () => {
    render(
      <AuthPermissionsProvider permissions={['agent:manage']}>
        <PermissionsInspector />
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('has-manage')).toHaveTextContent('true');
    expect(screen.getByTestId('has-read')).toHaveTextContent('true');
  });

  it('creates ability with no permissions when array is empty', () => {
    render(
      <AuthPermissionsProvider permissions={[]}>
        <PermissionsInspector />
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('has-manage')).toHaveTextContent('false');
    expect(screen.getByTestId('has-read')).toHaveTextContent('false');
  });

  it('defaults isLoading to false', () => {
    render(
      <AuthPermissionsProvider permissions={[]}>
        <PermissionsInspector />
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('passes isLoading=true when set', () => {
    render(
      <AuthPermissionsProvider permissions={[]} isLoading={true}>
        <PermissionsInspector />
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('updates ability when permissions change', () => {
    const { rerender } = render(
      <AuthPermissionsProvider permissions={[]}>
        <PermissionsInspector />
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('has-manage')).toHaveTextContent('false');

    rerender(
      <AuthPermissionsProvider permissions={['agent:manage']}>
        <PermissionsInspector />
      </AuthPermissionsProvider>,
    );
    expect(screen.getByTestId('has-manage')).toHaveTextContent('true');
  });
});
