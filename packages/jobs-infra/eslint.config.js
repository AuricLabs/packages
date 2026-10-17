/* eslint-disable import/no-duplicates -- distinct subpath configs share one package type declaration */
import sstConfig from '@auriclabs/eslint-config/sst';
import vitestConfig from '@auriclabs/eslint-config/vitest';

export default [...sstConfig, ...vitestConfig];
