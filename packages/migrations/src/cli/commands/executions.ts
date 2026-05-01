import path from 'path';

import { Command } from 'commander';

import { getExecutions } from '../../api/routes/executions';
import { getMigrationById } from '../../api/routes/migrations';
import { formatDuration, formatRelative, pad } from '../format';

import { renderRunDetail } from './_render-run';

import type { MigrationRunnerConfig } from '../../types';

/* eslint-disable no-console */

export const executionsCommand = new Command('executions')
  .description('List recent migration executions, or drill into one when an id is given')
  .argument('[id]', 'Optional execution id to drill into')
  .option('-c, --config <path>', 'Path to migration config file', './migrate.config.ts')
  .option('-l, --limit <n>', 'Maximum executions to list', '20')
  .option('--detail', 'In detail mode, expand each migration with description/result/output')
  .action(
    async (
      id: string | undefined,
      options: { config: string; limit: string; detail?: boolean },
    ) => {
      const configPath = path.resolve(options.config);
      const mod = (await import(configPath)) as { default: MigrationRunnerConfig };
      const { storage } = mod.default;

      if (id) {
        await renderExecutionDetail(storage, id, !!options.detail);
        return;
      }

      const limit = Number.parseInt(options.limit, 10);
      const executions = await getExecutions(storage);
      const head = executions.slice(0, Number.isFinite(limit) ? limit : 20);

      if (head.length === 0) {
        console.log('No executions found.');
        return;
      }

      console.log(`Recent executions (${String(head.length)}):`);
      console.log('\u2500'.repeat(96));
      console.log(
        `  ${pad('ID', 38)}${pad('STATUS', 12)}${pad('DIR', 6)}${pad('COUNT', 7)}${pad('STARTED', 12)}DURATION`,
      );
      for (const exec of head) {
        const duration =
          exec.completedAt !== undefined ? formatDuration(exec.completedAt - exec.startedAt) : '-';
        console.log(
          `  ${pad(exec.executionId, 38)}${pad(exec.status, 12)}${pad(exec.direction, 6)}${pad(String(exec.migrationCount), 7)}${pad(formatRelative(exec.startedAt), 12)}${duration}`,
        );
      }
    },
  );

async function renderExecutionDetail(
  storage: MigrationRunnerConfig['storage'],
  executionId: string,
  detail: boolean,
): Promise<void> {
  const records = await storage.getRecordsByExecutionId(executionId);
  if (records.length === 0) {
    console.log(`Execution not found: ${executionId}`);
    process.exitCode = 1;
    return;
  }

  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);
  const startedAt = sorted[0].startedAt;
  const lastRecord = sorted[sorted.length - 1];
  const completedAt = lastRecord.completedAt;
  const direction = sorted[0].direction;

  const failed = records.filter((r) => r.status === 'failed').length;
  const running = records.filter((r) => r.status === 'running').length;
  const completed = records.filter((r) => r.status === 'completed').length;
  const status = running > 0 ? 'running' : failed > 0 ? 'failed' : 'completed';
  const totalDuration = completedAt !== undefined ? completedAt - startedAt : undefined;

  console.log(`Execution: ${executionId}`);
  console.log(`Status:    ${status} (${direction})`);
  console.log(`Started:   ${formatRelative(startedAt)}`);
  console.log(`Duration:  ${formatDuration(totalDuration)}`);
  console.log(
    `Migrations (${String(records.length)}): ${String(completed)} completed, ${String(failed)} failed, ${String(running)} running`,
  );
  console.log('\u2500'.repeat(72));

  for (const record of sorted) {
    const mark =
      record.status === 'completed' ? '\u2713' : record.status === 'failed' ? '\u2717' : '\u25CB';
    console.log(`  ${mark} ${record.id} (${formatDuration(record.duration)})`);

    if (detail) {
      // Look up the *latest* state of this migration so the user sees the
      // up-to-date description even if it's been edited and re-run since
      // this execution. Output/metadata/error stay scoped to *this* run.
      const all = await getMigrationById(storage, record.id);
      const latestDescription = all.length > 0 ? all[0].description : undefined;
      console.log(
        renderRunDetail({
          ...record,
          description: latestDescription ?? record.description,
        }),
      );
    }
  }
}
