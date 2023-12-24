export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testMatch: ['**/*.test.ts'],
  //Ignore the extension of imports if provided so it doesn't conflict
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  }
};