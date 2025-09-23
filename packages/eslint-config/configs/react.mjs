// @ts-check

import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import commonConfig from './common-ts.mjs';
import jestConfig from './jest.mjs';

export default tseslint.config(
  ...commonConfig,
  ...jestConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
    },
  },
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    // @ts-ignore
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },
);
