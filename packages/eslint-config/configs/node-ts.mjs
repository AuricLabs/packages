// @ts-check
import commonNodeConfig from './common-node.mjs';
import commonTsConfig from './common-ts.mjs';
import vitestConfig from './vitest.mjs';

export default [...commonTsConfig, ...commonNodeConfig, ...vitestConfig];
