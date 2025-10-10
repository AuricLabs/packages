import { cloneDeep } from 'lodash-es';

export interface MetricsRecord {
  totalRecords: number;
  totalDuration: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  totalErrors: number;
  lastError?: unknown;
}

const records: Record<string, MetricsRecord> = {};

/**
 * Record the duration of a function call
 * @param name - The name of the function
 * @param duration - The duration of the function call
 */
export const recordMetrics = (name: string, duration: number, error?: unknown) => {
  const record = (records[name] ??= {
    totalRecords: 0,
    totalDuration: 0,
    averageDuration: 0,
    maxDuration: 0,
    minDuration: Infinity,
    totalErrors: 0,
  });

  record.totalRecords++;
  record.totalDuration += duration;
  record.averageDuration = record.totalDuration / record.totalRecords;
  record.maxDuration = Math.max(record.maxDuration, duration);
  record.minDuration = Math.min(record.minDuration, duration);
  record.totalErrors += error ? 1 : 0;
  record.lastError = error === undefined ? record.lastError : error;
};

/**
 * Get the metrics
 * @returns The metrics
 */
export const getMetrics = () => {
  return cloneDeep(records);
};

/**
 * Reset the metrics
 */
export const resetMetrics = () => {
  Object.keys(records).forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete records[key];
  });
};
