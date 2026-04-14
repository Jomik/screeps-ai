/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  coverageReporters: [['lcov', { projectRoot: '../..' }]],
  collectCoverageFrom: ['src/**/*.ts'],
};

module.exports = config;
