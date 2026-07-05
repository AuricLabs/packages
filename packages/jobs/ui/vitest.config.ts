import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Keep the vitest transform cache away from vite build's cache dir so
  // `turbo build test` can run both concurrently without corrupting either.
  cacheDir: 'node_modules/.vitest',
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
