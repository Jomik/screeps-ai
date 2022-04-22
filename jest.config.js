/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'screeps-jest',
  collectCoverageFrom: ['src/**/*.ts'],
  setupFilesAfterEnv: ['./test/setup.ts'],
};

module.exports = config;
