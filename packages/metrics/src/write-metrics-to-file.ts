import { writeFile } from 'node:fs/promises';

import { getMetrics } from './metrics';

import type { MetricsRecord } from './metrics';

/**
 * Convert metrics to CSV format
 */
const metricsToCSV = (records: Record<string, MetricsRecord>): string => {
  // CSV header
  const header = [
    'Span',
    'Total Calls',
    'Average Duration (ms)',
    'Min Duration (ms)',
    'Max Duration (ms)',
    'Total Duration (ms)',
    'Total Errors',
  ].join(',');

  // Sort keys alphabetically for consistent output
  const sortedKeys = Object.keys(records).sort();

  // Convert each record to a CSV row
  const rows = sortedKeys.map((key) => {
    const metrics = records[key];
    // Escape quotes in CSV by doubling them
    const escapedKey = key.replace(/"/g, '""');
    return [
      `"${escapedKey}"`, // Quote the span name in case it contains special characters
      metrics.totalRecords,
      metrics.averageDuration.toFixed(2),
      metrics.minDuration === Infinity ? '0.00' : metrics.minDuration.toFixed(2),
      metrics.maxDuration.toFixed(2),
      metrics.totalDuration.toFixed(2),
      metrics.totalErrors,
    ].join(',');
  });

  return [header, ...rows].join('\n');
};

/**
 * Write metrics to a CSV file
 * @param filePath - The path where the CSV file should be written
 * @returns A promise that resolves when the file is written
 */
export const writeMetricsToFile = async (filePath: string): Promise<void> => {
  const records = getMetrics();

  if (Object.keys(records).length === 0) {
    throw new Error('No metrics to write. Record some metrics first.');
  }

  const csv = metricsToCSV(records);
  await writeFile(filePath, csv, 'utf-8');
};
