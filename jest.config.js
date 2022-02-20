/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  silent: false,
  testPathIgnorePatterns : [
    '<rootDir>/src/test' 
  ]
};