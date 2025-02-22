/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  moduleNameMapper: { "^~/(.*)$": "<rootDir>/$1" },
  preset: "ts-jest",
  resetMocks: true,
  resetModules: true,
  testEnvironment: "node",
};
