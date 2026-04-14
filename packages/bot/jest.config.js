/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/setup.ts'],
  coverageReporters: [['lcov', { projectRoot: '../..' }]],
  collectCoverageFrom: ['src/**/*.ts'],
};

module.exports = config;
