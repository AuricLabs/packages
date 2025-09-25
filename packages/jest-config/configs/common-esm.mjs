/**
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.jsx'],
  testPathIgnorePatterns: ['.*/dist/', '.*/node_modules/'],
  transform: {
    '^.+\\.[t]sx?$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json', 'jsx', 'tsx'],
  setupFilesAfterEnv: [],
  collectCoverage: true,
};
