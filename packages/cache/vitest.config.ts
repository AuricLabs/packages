import path from 'path';

import nodeConfig from '@auriclabs/vitest-config/sst';

export default {
  ...nodeConfig,
  resolve: {
    alias: {
      '@auriclabs/logger': path.resolve(import.meta.dirname, '__mocks__/@auriclabs/logger.ts'),
    },
  },
};
