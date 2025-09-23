import commonJsConfig from './common-js.mjs';
import commonNodeConfig from './common-node.mjs';

/**
 * @type {import('typescript-eslint').InfiniteDepthConfigWithExtends[]}
 */
export default [...commonJsConfig, ...commonNodeConfig];
