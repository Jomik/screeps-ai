const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'screeps-jest',
  collectCoverageFrom: ['src/**/*.ts'],
  modulePaths: [compilerOptions.baseUrl],
  setupFilesAfterEnv: ['./test/setup.ts'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: `<rootDir>/${compilerOptions.baseUrl}`,
  }),
};

module.exports = config;
