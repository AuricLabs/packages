import chalk from 'chalk';
import Table from 'cli-table3';

import { getMetrics } from './metrics';

import type { MetricsRecord } from './metrics';

interface TreeNode {
  name: string;
  fullPath: string;
  children: Map<string, TreeNode>;
  metrics?: MetricsRecord;
}

interface TreeRow {
  prefix: string;
  name: string;
  metrics?: MetricsRecord;
}

/**
 * Build a tree structure from dot-separated metric keys
 */
const buildMetricsTree = (records: Record<string, MetricsRecord>): TreeNode => {
  const root: TreeNode = { name: 'Metrics', fullPath: '', children: new Map() };
  const allKeys = Object.keys(records).sort();

  for (const key of allKeys) {
    const parts = key.split('.');
    let current = root;
    let path = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      path = path ? `${path}.${part}` : part;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: path,
          children: new Map(),
        });
      }

      const child = current.children.get(part);
      if (!child) continue;
      current = child;

      // If this is the last part, attach the metrics
      if (i === parts.length - 1) {
        current.metrics = records[key];
      }
    }
  }

  return root;
};

/**
 * Flatten tree into rows with tree prefixes
 */
const flattenTreeToRows = (node: TreeNode, prefix = '', isLast = true, depth = 0): TreeRow[] => {
  const rows: TreeRow[] = [];

  if (depth > 0) {
    const connector = isLast ? '└── ' : '├── ';
    rows.push({
      prefix: prefix + connector,
      name: node.name,
      metrics: node.metrics,
    });
  }

  const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const childCount = sortedChildren.length;
  sortedChildren.forEach((child, index) => {
    const isLastChild = index === childCount - 1;
    const extension = depth > 0 ? (isLast ? '    ' : '│   ') : '';
    const newPrefix = prefix + extension;

    rows.push(...flattenTreeToRows(child, newPrefix, isLastChild, depth + 1));
  });

  return rows;
};

/**
 * Display metrics summary table
 */
const displaySummaryTable = (records: Record<string, MetricsRecord>) => {
  const entries = Object.entries(records);

  if (entries.length === 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('No metrics recorded yet.'));
    return;
  }

  // Calculate totals
  const totals = entries.reduce(
    (acc, [, metrics]) => ({
      calls: acc.calls + metrics.totalRecords,
      duration: acc.duration + metrics.totalDuration,
      errors: acc.errors + metrics.totalErrors,
    }),
    { calls: 0, duration: 0, errors: 0 },
  );

  // Summary table
  const summaryTable = new Table({
    head: [
      chalk.bold.cyan('Total Calls'),
      chalk.bold.cyan('Total Duration'),
      chalk.bold.cyan('Total Errors'),
      chalk.bold.cyan('Avg Duration'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  summaryTable.push([
    chalk.white(totals.calls.toString()),
    chalk.magenta(`${totals.duration.toFixed(2)}ms`),
    totals.errors > 0 ? chalk.red(totals.errors.toString()) : chalk.green('0'),
    chalk.yellow(`${(totals.duration / totals.calls).toFixed(2)}ms`),
  ]);

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold.blue('═══ Metrics Summary ═══'));
  // eslint-disable-next-line no-console
  console.log(summaryTable.toString());
};

/**
 * Display metrics tree in table format
 */
const displayMetricsTreeTable = (records: Record<string, MetricsRecord>) => {
  const tree = buildMetricsTree(records);
  const rows = flattenTreeToRows(tree);

  const metricsTable = new Table({
    head: [
      chalk.bold.cyan('Span'),
      chalk.bold.cyan('Calls'),
      chalk.bold.cyan('Avg'),
      chalk.bold.cyan('Min'),
      chalk.bold.cyan('Max'),
      chalk.bold.cyan('Total'),
      chalk.bold.cyan('Errors'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths: [45, 8, 12, 12, 12, 12, 9],
  });

  for (const row of rows) {
    if (row.metrics) {
      const m = row.metrics;
      metricsTable.push([
        chalk.gray(row.prefix) + chalk.cyan(row.name),
        chalk.white(m.totalRecords.toString()),
        chalk.yellow(`${m.averageDuration.toFixed(2)}ms`),
        chalk.green(`${m.minDuration.toFixed(2)}ms`),
        chalk.red(`${m.maxDuration.toFixed(2)}ms`),
        chalk.magenta(`${m.totalDuration.toFixed(2)}ms`),
        m.totalErrors > 0 ? chalk.bgRed.white(` ${m.totalErrors} `) : chalk.green('0'),
      ]);
    } else {
      // Parent node without metrics - show just the tree structure
      metricsTable.push([
        chalk.gray(row.prefix) + chalk.cyan.bold(row.name),
        chalk.gray('─'),
        chalk.gray('─'),
        chalk.gray('─'),
        chalk.gray('─'),
        chalk.gray('─'),
        chalk.gray('─'),
      ]);
    }
  }

  // eslint-disable-next-line no-console
  console.log('\n' + chalk.bold.blue('═══ Metrics Tree ═══'));
  // eslint-disable-next-line no-console
  console.log(metricsTable.toString());
};

/**
 * Display metrics in a hierarchical tree format with statistics
 */
export const displayMetrics = () => {
  const records = getMetrics();

  if (Object.keys(records).length === 0) {
    // eslint-disable-next-line no-console
    console.log('\n' + chalk.yellow('No metrics recorded yet.') + '\n');
    return;
  }

  // Display summary table
  displaySummaryTable(records);

  // Display metrics tree in table format
  displayMetricsTreeTable(records);
};
