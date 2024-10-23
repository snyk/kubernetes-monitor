module.exports = {
  preset: "ts-jest",
  testEnvironment: './jest-environment-fail-fast.ts',
  testRunner: 'jest-circus/runner',
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  testTimeout: 900000, // 15 minutes. Must match UPSTREAM_POLLING_CONFIGURATION in test/helpers/kubernetes-upstream.ts
  bail: true,
  clearMocks: true,
  errorOnDeprecated: true,

  // This is here until a bug in Jest (which in turn affects ts-jest) is resolved.
  // It affects our CI/CD runs and makes the machine run out of memory.
  // https://github.com/facebook/jest/issues/10550
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
