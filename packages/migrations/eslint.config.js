import nodeTsConfig from '@auriclabs/eslint-config/node-ts';

export default [
  // `dockerfiles/runner/wrapper.mjs` runs INSIDE the published Docker image,
  // not in this package's host environment. Its imports (`@aws-sdk/client-s3`)
  // resolve from `dockerfiles/runner/runner-package.json` at image build time,
  // not from this workspace's node_modules — so host-side lint can't resolve
  // them. Exclude the whole directory.
  { ignores: ['ui/', 'dockerfiles/'] },
  ...nodeTsConfig,
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
];
