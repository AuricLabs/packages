// @ts-check

import fs from 'fs';

import vitest from 'eslint-plugin-vitest';
import tseslint from 'typescript-eslint';

// type definition for eslint config array
/**
 * @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray}
 */
export default tseslint.config([
  {
    files: [
      '**/*.{test,spec}.{ts,tsx,js,jsx}',
      '**/__mocks__/**/*.{ts,js}',
      '**/__tests__/**/*.{ts,js}',
      'vitest.config.ts',
    ],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
    languageOptions: {
      globals: vitest.environments.env.globals, // add `describe`, `it`, etc
      parser: tseslint.parser,
      parserOptions: {
        project: ['tsconfig.test.json', 'tsconfig.json'].filter(fs.existsSync),
        // tsconfigRootDir: process.cwd(),
      },
    },
  },
]);
