import { useState, useEffect } from 'react';

const UNITS: [string, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

function formatTimeAgo(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  if (diff < 1000) return 'just now';

  for (const [unit, ms] of UNITS) {
    const value = Math.floor(diff / ms);
    if (value >= 1) {
      return `${value} ${unit}${value > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

interface TimeAgoProps {
  /** ISO 8601 timestamp string. */
  timestamp: string;
}

export function TimeAgo({ timestamp }: TimeAgoProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const date = new Date(timestamp);
  const ms = date.getTime();
  if (Number.isNaN(ms)) {
    return <span>-</span>;
  }

  return <span title={date.toLocaleString()}>{formatTimeAgo(ms)}</span>;
}
