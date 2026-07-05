import nodeTsConfig from '@auriclabs/eslint-config/node-ts';

export default [
  // The dashboard UI has its own toolchain (vite build/vitest run from ui/);
  // it is not part of this package's node lint surface.
  { ignores: ['ui/'] },
  ...nodeTsConfig,
];
