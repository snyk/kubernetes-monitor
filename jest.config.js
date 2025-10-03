module.exports = {
  preset: "ts-jest",
  testEnvironment: './jest-environment-fail-fast.ts',
  testRunner: 'jest-circus/runner',
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  testTimeout: 900000, // 15 minutes. Must match UPSTREAM_POLLING_CONFIGURATION in test/helpers/kubernetes-upstream.ts
  bail: true,
  clearMocks: true,
  errorOnDeprecated: true,

  // Transform ESM packages from node_modules
  // By default Jest ignores node_modules, but @kubernetes/client-node v1.0.0+ is ESM-only
  // Also need to transform its ESM dependencies: openid-client, oauth4webapi, jose
  transformIgnorePatterns: [
    'node_modules/(?!(@kubernetes/client-node|openid-client|oauth4webapi|jose))'
  ],

  // Treat .js files from @kubernetes/client-node as ESM
  extensionsToTreatAsEsm: ['.ts'],
  
  // Modern ts-jest configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      // This is here until a bug in Jest (which in turn affects ts-jest) is resolved.
      // It affects our CI/CD runs and makes the machine run out of memory.
      // https://github.com/facebook/jest/issues/10550
      isolatedModules: true,
      useESM: false,
    }],
    // Transform ESM JavaScript files from @kubernetes/client-node with CommonJS output
    '^.+\\.js$': ['ts-jest', {
      isolatedModules: true,
      useESM: false,
      tsconfig: {
        allowJs: true,
        checkJs: false,
        module: 'commonjs',
      },
    }],
  },
  
  // Map ESM module imports to their locations
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
