// @ts-check

import tseslint from 'typescript-eslint';

import commonJsConfig from './common-js.mjs';

export default tseslint.config(
  ...commonJsConfig,
  ...[
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.js', '*.mjs'],
          },
          tsconfigRootDir: process.cwd(),
        },
      },
    },
    {
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
  ].map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
);
