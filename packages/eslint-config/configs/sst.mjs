// @ts-check

import tseslint from 'typescript-eslint';

import nodeTsConfig from './node-ts.mjs';

export default tseslint.config(
  ...nodeTsConfig,
  {
    ignores: ['.sst/'],
  },
  {
    languageOptions: {
      globals: {
        require: 'readonly',
        $config: 'readonly',
        aws: 'readonly',
        sst: 'readonly',
        $app: 'readonly',
        $asset: 'readonly',
        $util: 'readonly',
        $dev: 'readonly',
        $output: 'readonly',
        $resolve: 'readonly',
        $interpolate: 'readonly',
        $concat: 'readonly',
        $jsonParse: 'readonly',
        $jsonStringify: 'readonly',
        $transform: 'readonly',
        $linkable: 'readonly',
      },
    },
  },
);
