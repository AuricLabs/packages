import path from 'path';

import sstConfig from '@auriclabs/vitest-config/sst';

export default {
  ...sstConfig,
  resolve: {
    alias: {
      fs: path.resolve(import.meta.dirname, '__mocks__/fs.cjs'),
    },
  },
};
