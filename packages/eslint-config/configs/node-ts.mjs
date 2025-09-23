// @ts-check
import tseslint from 'typescript-eslint';

import commonNodeConfig from './common-node.mjs';
import commonTsConfig from './common-ts.mjs';
import jestConfig from './jest.mjs';

export default tseslint.config(...commonTsConfig, ...jestConfig, ...commonNodeConfig, {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'no-unused-vars': 'off', // Disable base ESLint rule for TypeScript files
    'n/no-missing-import': 'off', // Disable n rule for TypeScript files
  },
});
