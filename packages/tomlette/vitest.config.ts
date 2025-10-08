import nodeTsConfig from '@auriclabs/vitest-config/node';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...nodeTsConfig,
  test: {
    ...nodeTsConfig.test,
  },
});
