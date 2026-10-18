import { describe, expect, it } from 'vitest';

import { createAbility } from '../ability';
import { flattenPermissions, stringifyPermission, Subject } from '../permissions';
import { createPermissionsFromRoles } from '../roles';

import { createScopeRegex } from './create-scope-regex';
import { SCOPE_ENCODING_VERSION } from './encoding-version';
import { isParentScope } from './is-parent-scope';
import { parseScope } from './parse-scope';
import { stringifyScope } from './stringify-scope';
import { Scope } from './types';

describe('case-preserving scope identifiers', () => {
  it('identifies serialized claims with encoding version 2', () => {
    expect(SCOPE_ENCODING_VERSION).toBe(2);
  });

  it('normalizes scope type names without changing opaque IDs', () => {
    const scope = 'ORG:TenantA:AGENT:agt_Case' as Scope;

    expect(stringifyScope(scope)).toBe('org:TenantA:agent:agt_Case');
    expect(stringifyScope(['ORG', 'TenantA', 'AGENT', 'agt_Case'] as unknown as Scope)).toBe(
      'org:TenantA:agent:agt_Case',
    );
    expect(
      stringifyScope([
        { type: 'ORG', id: 'TenantA' },
        { type: 'AGENT', id: 'agt_Case' },
      ]),
    ).toBe('org:TenantA:agent:agt_Case');
    expect(parseScope(scope)).toStrictEqual([
      { type: 'org', id: 'TenantA' },
      { type: 'agent', id: 'agt_Case' },
    ]);
    expect(
      parseScope([
        { type: 'ORG', id: 'TenantA' },
        { type: 'AGENT', id: 'agt_Case' },
      ]),
    ).toStrictEqual([
      { type: 'org', id: 'TenantA' },
      { type: 'agent', id: 'agt_Case' },
    ]);
  });

  it('preserves ID whitespace and normalizes only scope type spelling', () => {
    const scope = ' ORG :TenantA: AGENT :agt_Case ' as Scope;

    expect(stringifyScope(scope)).toBe('org:TenantA:agent:agt_Case ');
    expect(parseScope(scope)).toStrictEqual([
      { type: 'org', id: 'TenantA' },
      { type: 'agent', id: 'agt_Case ' },
    ]);
    expect(parseScope([' AGENT ', ' agt_Case '] as unknown as Scope)).toStrictEqual([
      { type: 'agent', id: ' agt_Case ' },
    ]);
    expect(parseScope([{ type: ' AGENT ', id: ' agt_Case ' }])).toStrictEqual([
      { type: 'agent', id: ' agt_Case ' },
    ]);
  });

  it('matches exact IDs through string claims, including nested wildcards', () => {
    const ability = createAbility(['org:TenantA:agent:agt_Case:connection:read']);

    expect(ability.has('org:TenantA:agent:agt_Case:connection:read')).toBe(true);
    expect(ability.has('org:TenantA:agent:agt_case:connection:read')).toBe(false);
    expect(ability.has('org:tenanta:agent:agt_Case:connection:read')).toBe(false);

    const descendants = createAbility(['org:TenantA:agent:agt_Case:**:all:manage']);
    expect(descendants.has('org:TenantA:agent:agt_Case:wallet:transfer:read')).toBe(true);
    expect(descendants.has('org:TenantA:agent:agt_case:wallet:transfer:read')).toBe(false);
  });

  it('applies a scoped denial only to the exact resource ID', () => {
    const ability = createAbility([
      'org:TenantA:**:all:manage',
      '!org:TenantA:agent:agt_Case:connection:read',
    ]);

    expect(ability.has('org:TenantA:agent:agt_Case:connection:read')).toBe(false);
    expect(ability.has('org:TenantA:agent:agt_case:connection:read')).toBe(true);
  });

  it('retains exact IDs through role hydration and permission serialization', () => {
    const hydrated = createPermissionsFromRoles([
      {
        scope: 'org:TenantA:agent:agt_Case',
        permissions: [{ subject: 'connection' as Subject, action: 'read' }],
      },
    ]);
    const claims = flattenPermissions(hydrated).map(stringifyPermission);

    expect(claims).toContain('org:TenantA:agent:agt_Case:connection:read');
    expect(createAbility(claims).has('org:TenantA:agent:agt_Case:connection:read')).toBe(true);
    expect(createAbility(claims).has('org:TenantA:agent:agt_case:connection:read')).toBe(false);
  });

  it('keeps an ID with trailing whitespace isolated through role hydration', () => {
    const hydrated = createPermissionsFromRoles([
      {
        scope: 'org:TenantA:agent:agt_Case ',
        permissions: [{ subject: 'connection' as Subject, action: 'read' }],
      },
    ]);
    const claims = flattenPermissions(hydrated).map(stringifyPermission);
    const ability = createAbility(claims);

    expect(claims).toContain('org:TenantA:agent:agt_Case :connection:read');
    expect(ability.has('org:TenantA:agent:agt_Case :connection:read')).toBe(true);
    expect(ability.has('org:TenantA:agent:agt_Case:connection:read')).toBe(false);
  });

  it('does not let a denial for one exact ID affect another ID', () => {
    const hydrated = createPermissionsFromRoles([
      {
        scope: 'org:TenantA:agent:agt_Case ',
        permissions: [{ type: 'cannot', subject: 'connection' as Subject, action: 'read' }],
      },
    ]);
    const claims = flattenPermissions(hydrated).map(stringifyPermission);
    const ability = createAbility(['org:TenantA:**:all:manage', ...claims]);

    expect(claims).toContain('!org:TenantA:agent:agt_Case :connection:read');
    expect(ability.has('org:TenantA:agent:agt_Case :connection:read')).toBe(false);
    expect(ability.has('org:TenantA:agent:agt_Case:connection:read')).toBe(true);
  });

  it('keeps ancestor checks and generated scope regexes case-sensitive for IDs', () => {
    expect(
      isParentScope('ORG:TenantA:AGENT:agt_Case' as Scope, 'org:TenantA:agent:agt_Case:wallet:W1'),
    ).toBe(true);
    expect(isParentScope('org:TenantA:agent:agt_Case', 'org:TenantA:agent:agt_case')).toBe(false);

    const regex = createScopeRegex('org:TenantA:agent:agt_Case');
    expect(regex.test('org:TenantA:agent:agt_Case')).toBe(true);
    expect(regex.test('org:TenantA:agent:agt_case')).toBe(false);
  });

  it('does not merge ancestor scopes whose IDs differ by whitespace', () => {
    const spaced = 'agent:agt_Case ' as Scope;
    const plain = 'agent:agt_Case' as Scope;

    expect(isParentScope(spaced, spaced)).toBe(true);
    expect(isParentScope(spaced, plain)).toBe(false);
    expect(isParentScope(plain, spaced)).toBe(false);
    expect(isParentScope('agent: ' as Scope, plain)).toBe(false);
    expect(parseScope('agent: ' as Scope)).toStrictEqual([{ type: 'agent', id: ' ' }]);
  });
});
