import { useState, useEffect } from 'react';

const UNITS: [string, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
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
  timestamp: number;
}

export function TimeAgo({ timestamp }: TimeAgoProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const title = new Date(timestamp).toLocaleString();
  return <span title={title}>{formatTimeAgo(timestamp)}</span>;
}
