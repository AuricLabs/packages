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

export interface MigrationStorage {
  getRecord(id: string, direction?: MigrationDirection): Promise<MigrationRecord | null>;
  getAllRecords(): Promise<MigrationRecord[]>;
  getRecordsByStatus(status: MigrationStatus): Promise<MigrationRecord[]>;
  getRecordsByExecutionId(executionId: string): Promise<MigrationRecord[]>;
  createRecord(record: Omit<MigrationRecord, 'createdAt' | 'updatedAt'>): Promise<MigrationRecord>;
  updateRecord(
    id: string,
    direction: MigrationDirection,
    executionId: string,
    updates: Partial<Omit<MigrationRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MigrationRecord>;
}
