// @ts-check

import fs from 'fs';

import tseslint from 'typescript-eslint';

import commonJsConfig from './common-js.mjs';

export default tseslint.config(
  ...commonJsConfig,
  ...tseslint.configs.strictTypeChecked
    .concat(tseslint.configs.stylisticTypeChecked)
    .map((config) => ({
      ...config,
      // @ts-ignore
      files: config.files ?? ['**/*.{ts,tsx,d.ts}'],
    })),
  {
    files: ['**/*.{ts,tsx,d.ts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['tsconfig.build.json', 'tsconfig.json'].filter(fs.existsSync),
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
          allowDefaultProject: ['*.js', '*.mjs', '*.cjs', '.*.js', '*.ts', '*.tsx', '*.d.ts'],
        },
      },
    },
  },
);
