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
    files: [
      'eslint.config.js',
      'eslint.config.mjs',
      'jest.config.js',
      'jest.config.mjs',
      '.lintstagedrc.js',
    ],
    rules: {
      'n/no-extraneous-import': 'off',
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
];
