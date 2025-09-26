import path from 'path';

import sstConfig from '@auriclabs/vitest-config/sst';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...sstConfig,
  test: {
    ...sstConfig.test,
    server: {
      deps: {
        inline: ['to-vfile'],
      },
    },
  },
  resolve: {
    alias: {
      fs: path.resolve(import.meta.dirname, '__mocks__/fs.ts'),
    },
  },
});
