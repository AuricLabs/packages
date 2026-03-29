import reactConfig from '@auriclabs/eslint-config/react';

export default [
  ...reactConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.test.json'],
      },
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/setup-tests.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
      'n/no-extraneous-import': 'off',
    },
  },
];
