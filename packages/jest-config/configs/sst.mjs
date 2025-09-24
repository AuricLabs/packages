import commonConfig from './common-esm.mjs';

/**
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
export default {
  ...commonConfig,
  setupFiles: [import.meta.dirname + '/../setup/sst.setup.mjs'],
};
