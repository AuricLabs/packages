export type MigrationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back';

export type MigrationDirection = 'up' | 'down';

export interface MigrationRecord {
  id: string;
  name: string;
  status: MigrationStatus;
  direction: MigrationDirection;
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, unknown>;
  executionId: string;
  duration?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MigrationSummary {
  pending: number;
  completed: number;
  failed: number;
  total: number;
}

export interface ExecutionBatch {
  executionId: string;
  startedAt: number;
  completedAt?: number;
  status: 'completed' | 'failed' | 'running';
  migrationCount: number;
  direction: MigrationDirection;
}

export interface MigrateResponse {
  message: string;
  invoked: boolean;
}

export interface RollbackResponse {
  message: string;
  invoked: boolean;
}

export interface StatusResponse {
  pending: string[];
  completed: string[];
  failed: string[];
}

export type DisplayStatus =
  | 'pending'
  | 'migrated'
  | 'running'
  | 'failed'
  | 'reverted'
  | 'reverting'
  | 'revert_failed';

export function getDisplayStatus(status: MigrationStatus, direction: MigrationDirection): DisplayStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'running':
      return direction === 'down' ? 'reverting' : 'running';
    case 'completed':
      return direction === 'down' ? 'reverted' : 'migrated';
    case 'failed':
      return direction === 'down' ? 'revert_failed' : 'failed';
    case 'rolling_back':
      return direction === 'down' ? 'reverting' : 'failed';
    case 'rolled_back':
      return direction === 'down' ? 'reverted' : 'failed';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
