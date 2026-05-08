#!/usr/bin/env node

import { runDashboardCli } from '../src/dashboard-cli';

runDashboardCli(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`error: ${message}\n`);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
});
