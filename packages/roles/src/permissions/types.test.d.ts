import type { CRUDAction } from './types';

declare module './types' {
  interface PermissionDefinitions {
    all: CRUDAction;
    org: CRUDAction;
    app: CRUDAction | 'assign' | 'unassign' | 'assignUser';
    role: CRUDAction | 'assign' | 'unassign';
    user: CRUDAction | 'invite' | 'remove';
    webhook: CRUDAction;
    webhookSecret: CRUDAction | 'refresh';
    webhookSubscription: CRUDAction;
  }
}
