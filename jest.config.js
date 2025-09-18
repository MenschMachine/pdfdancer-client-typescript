module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*test-helpers.ts',
  ],
  projects: [
    {
      preset: 'ts-jest',
      testEnvironment: 'node',
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['<rootDir>/src/__tests__/e2e/'],
    },
    {
      preset: 'ts-jest',
      testEnvironment: 'node',
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/__tests__/e2e/**/*.test.ts'],
    }
  ]
};
