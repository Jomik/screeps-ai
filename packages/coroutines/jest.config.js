/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageReporters: [['lcov', { projectRoot: '../..' }]],
};

module.exports = config;
