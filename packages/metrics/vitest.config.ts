import path from 'path';

import nodeConfig from '@auriclabs/vitest-config/node';

export default {
  ...nodeConfig,
  test: {
    ...nodeConfig.test,
    // Run test files serially to avoid conflicts with shared metrics state
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@auriclabs/logger': path.resolve(import.meta.dirname, '__mocks__/@auriclabs/logger.ts'),
    },
  },
};
