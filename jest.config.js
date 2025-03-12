/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  moduleNameMapper: { "^~/(.*)$": "<rootDir>/$1" },
  preset: "ts-jest",
  resetMocks: true,
  resetModules: true,
  testEnvironment: "node",
};
