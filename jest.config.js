module.exports = {
  preset: 'ts-jest',
  testEnvironment: './jest-environment-fail-fast.ts',
  testRunner: 'jest-circus/runner',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testTimeout: 900000, // 15 minutes
  bail: true,
  clearMocks: true,
  errorOnDeprecated: true,
  moduleNameMapper: {
    '^@kubernetes/client-node$':
      '<rootDir>/test/setup/kubernetes-client-node.js',
  },

  // This is here until a bug in Jest (which in turn affects ts-jest) is resolved.
  // It affects our CI/CD runs and makes the machine run out of memory.
  // https://github.com/facebook/jest/issues/10550
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
