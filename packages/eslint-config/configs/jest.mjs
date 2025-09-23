// @ts-check

import pluginJest from 'eslint-plugin-jest';

// type definition for eslint config array
/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
export default [
  {
    files: [
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.spec.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
    ],
    plugins: {
      jest: pluginJest,
    },
    languageOptions: {
      globals: pluginJest.environments.globals.globals,
    },
    rules: {
      // Jest rules
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/valid-expect': 'error',
      'jest/valid-expect-in-promise': 'error',
      'jest/no-conditional-expect': 'error',
      'jest/expect-expect': 'off', // Can be enabled if you want to enforce expect calls
      'jest/no-test-return-statement': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/prefer-to-be': 'warn',
      'jest/prefer-to-contain': 'warn',
      'jest/prefer-strict-equal': 'warn',
      'jest/prefer-called-with': 'warn',
      'jest/prefer-spy-on': 'warn',
      'jest/no-alias-methods': 'warn',
      'jest/no-restricted-matchers': 'off',
      'jest/valid-describe-callback': 'error',
      'jest/valid-title': 'error',
      'jest/no-mocks-import': 'error',
      'jest/no-standalone-expect': 'error',
      'jest/no-hooks': 'off',
      'jest/prefer-hooks-on-top': 'warn',
      'jest/no-duplicate-hooks': 'error',
      'jest/no-export': 'error',
      'jest/no-restricted-jest-methods': 'off',
      'jest/no-test-prefixes': 'error',
      'jest/prefer-expect-assertions': 'off',
      'jest/prefer-expect-resolves': 'warn',
      'jest/prefer-lowercase-title': 'off',
      'jest/prefer-mock-promise-shorthand': 'warn',
      'jest/require-hook': 'off',
      'jest/require-to-throw-message': 'off',
      'jest/require-top-level-describe': 'off',
      'jest/unbound-method': 'error',
    },
  },
];
