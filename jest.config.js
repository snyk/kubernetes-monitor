module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  testTimeout: 600000, // 10 minutes
  bail: true,
  clearMocks: true,
  errorOnDeprecated: true,

  /** https://github.com/facebook/jest/issues/2867#issuecomment-546592968 */
  setupFilesAfterEnv: ["./jest.setup-after-env.js"],

  // TODO: This is here until a bug in Jest (which in turn affects ts-jest) is resolved.
  // It affects our CI/CD runs and makes the machine run out of memory.
  // https://github.com/facebook/jest/issues/10550
  // https://snyk.slack.com/archives/CLW30N31V/p1602232569018000?thread_ts=1602230753.017500&cid=CLW30N31V
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
