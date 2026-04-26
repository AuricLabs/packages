import nodeTsConfig from '@auriclabs/eslint-config/node-ts';

export default [
  { ignores: ['ui/'] },
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
