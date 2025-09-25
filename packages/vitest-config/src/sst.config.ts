import path from 'path';

import { defineConfig } from 'vitest/config';

import nodeConfig from './node.config.js';

export default defineConfig({
  ...nodeConfig,
  test: {
    ...nodeConfig.test,
    setupFiles: [path.join(import.meta.dirname, './setup/sst.setup.js')],
  },
});
