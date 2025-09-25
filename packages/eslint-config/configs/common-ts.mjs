// @ts-check

import fs from 'fs';
import path from 'path';

import tseslint from 'typescript-eslint';

import commonJsConfig from './common-js.mjs';

const tsconfigBuildJson = path.join(process.cwd(), 'tsconfig.build.json');
const hasTsconfigBuildJson = fs.existsSync(tsconfigBuildJson);

export default tseslint.config(
  ...commonJsConfig,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{ts,tsx,d.ts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: hasTsconfigBuildJson ? 'tsconfig.build.json' : 'tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allow: [{ from: 'lib', name: 'Error' }],
          allowBoolean: true,
          allowNumber: true,
          allowRegExp: true,
        },
      ],
    },
  },
  {
    files: [
      'eslint.config.js',
      'eslint.config.mjs',
      '.lintstagedrc.js',
      'vitest.config.js',
      'vitest.config.mjs',
    ],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs', '*.cjs', '.*.js'],
        },
      },
    },
  },
);
