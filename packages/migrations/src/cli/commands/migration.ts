import path from 'path';

import { Command } from 'commander';

import { getMigrationById } from '../../api/routes/migrations';
import { formatDuration, formatRelative, indent, pad } from '../format';

import { renderRunDetail } from './_render-run';

import type { MigrationRunnerConfig } from '../../types';

/* eslint-disable no-console */

export const migrationCommand = new Command('migration')
  .description("Show one migration's run history with description, result, and output")
  .argument('<id>', 'Migration id (filename stem, e.g. 20260601_add_user_roles)')
  .option('-c, --config <path>', 'Path to migration config file', './migrate.config.ts')
  .option('--latest', 'Only show the latest run (default)', true)
  .option('--all', 'Show all runs of this migration')
  .action(async (id: string, options: { config: string; all?: boolean }) => {
    const configPath = path.resolve(options.config);
    const mod = (await import(configPath)) as { default: MigrationRunnerConfig };
    const { storage } = mod.default;

    const records = await getMigrationById(storage, id);
    if (records.length === 0) {
      console.log(`Migration not found: ${id}`);
      process.exitCode = 1;
      return;
    }

    const latest = records[0];
    console.log(`${id} (${String(records.length)} ${records.length === 1 ? 'run' : 'runs'})`);
    if (latest.name && latest.name !== id) {
      console.log(`Name: ${latest.name}`);
    }
    console.log('');

    if (options.all) {
      for (const record of records) {
        renderHeader(record, formatRelative(record.createdAt));
        console.log(renderRunDetail(record));
      }
      return;
    }

    renderHeader(latest, `latest run, ${formatRelative(latest.createdAt)}`);
    console.log(renderRunDetail(latest));

    if (records.length > 1) {
      console.log('');
      console.log(
        `History (${String(records.length - 1)} earlier ${records.length - 1 === 1 ? 'run' : 'runs'}):`,
      );
      console.log('\u2500'.repeat(72));
      for (const r of records.slice(1)) {
        const mark =
          r.status === 'completed' ? '\u2713' : r.status === 'failed' ? '\u2717' : '\u25CB';
        console.log(
          `  ${mark} ${pad(r.direction, 6)}${pad(r.status, 12)}${pad(formatDuration(r.duration), 10)}${formatRelative(r.createdAt)}`,
        );
      }
      console.log('');
      console.log(`Use --all to expand each run.`);
    }
  });

function renderHeader(
  record: { status: string; direction: string; duration?: number },
  context: string,
): void {
  const status = `${record.status} ${record.direction}`;
  console.log(
    `\u2550\u2550\u2550 ${status} (${context}, ${formatDuration(record.duration)}) \u2550\u2550\u2550`,
  );
  // Empty line follows naturally via renderRunDetail's leading content
  void indent;
}
