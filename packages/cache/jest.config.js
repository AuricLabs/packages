import jestConfig from '@auriclabs/jest-config/node';

export default {
  ...jestConfig,
  moduleNameMapper: {
    '^@auriclabs/logger$': '<rootDir>/__mocks__/@auriclabs/logger.js',
  },
};
