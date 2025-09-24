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
  ].map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
);
