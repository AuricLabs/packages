import n from 'eslint-plugin-n';

/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
export default [
  n.configs['flat/recommended'],
  {
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    settings: {
      node: {
        version: '>=22.16.0',
      },
    },
  },
  {
    files: ['bin/**/*.ts'],
    rules: {
      'n/hashbang': 'off',
    },
  },
  {
    files: [
      'eslint.config.js',
      'eslint.config.mjs',
      'vitest.config.ts',
      'vitest.config.js',
      'vitest.config.mjs',
      '.lintstagedrc.js',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.spec.js',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.js',
      '**/__mocks__/**/*.ts',
      '**/__mocks__/**/*.js',
      '**/test/**/*.ts',
      '**/test/**/*.js',
      '**/tests/**/*.ts',
      '**/tests/**/*.js',
    ],
    rules: {
      'n/no-extraneous-import': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'n/no-missing-import': 'off', // Disable n rule for TypeScript files
    },
  },
];
