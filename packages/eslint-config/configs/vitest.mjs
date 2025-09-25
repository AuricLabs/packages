// @ts-check

import fs from 'fs';
import path from 'path';

import vitest from 'eslint-plugin-vitest';
import tseslint from 'typescript-eslint';

const tsconfigTestJson = path.join(process.cwd(), 'tsconfig.test.json');
const hasTsconfigTestJson = fs.existsSync(tsconfigTestJson);

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
        project: hasTsconfigTestJson ? 'tsconfig.test.json' : 'tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
    },
  },
]);
