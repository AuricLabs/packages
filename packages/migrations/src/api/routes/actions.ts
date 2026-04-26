import { invokeLambdaAsync, invokeLambdaSync } from '../../utils/lambda';

export interface MigrateResult {
  message: string;
  invoked: boolean;
}

export async function executeMigrate(
  migrationFunctionName: string | undefined,
  body: { target?: string },
): Promise<MigrateResult> {
  if (!migrationFunctionName) {
    return {
      message: 'Migrate is not available. Provide migrationFn to createDashboard() to enable it.',
      invoked: false,
    };
  }

  await invokeLambdaAsync(migrationFunctionName, {
    direction: 'up',
    target: body.target,
  });

  return { message: 'Migration initiated', invoked: true };
}

export interface RollbackResult {
  message: string;
  invoked: boolean;
}

export async function executeRollback(
  migrationFunctionName: string | undefined,
  body: { target?: string },
): Promise<RollbackResult> {
  if (!migrationFunctionName) {
    return {
      message: 'Rollback is not available. Provide migrationFn to createDashboard() to enable it.',
      invoked: false,
    };
  }

  await invokeLambdaAsync(migrationFunctionName, {
    direction: 'down',
    target: body.target,
  });

  return { message: 'Rollback initiated', invoked: true };
}

export interface StatusActionResult {
  pending: string[];
  completed: string[];
  failed: string[];
}

export async function getStatus(
  migrationFunctionName: string | undefined,
): Promise<StatusActionResult> {
  if (!migrationFunctionName) {
    return { pending: [], completed: [], failed: [] };
  }

  return invokeLambdaSync<StatusActionResult>(migrationFunctionName, {
    action: 'status',
  });
}
