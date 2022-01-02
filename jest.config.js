/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  silent: false,
  testResultsProcessor: 'jest-sonar-reporter',
  testPathIgnorePatterns : [
    '<rootDir>/src/test' 
  ]
};