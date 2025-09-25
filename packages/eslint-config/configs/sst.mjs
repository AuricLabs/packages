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
        awsnative: 'readonly',
        sst: 'readonly',
        $app: 'readonly',
        $util: 'readonly',
        $dev: 'readonly',
        $output: 'readonly',
        $jsonParse: 'readonly',
        $jsonStringify: 'readonly',
        $interpolate: 'readonly',
      },
    },
  },
);
