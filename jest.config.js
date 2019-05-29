module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [ 'src/**/*.ts' ],
  coverageReporters: ['text-summary', 'html'],
  setupTestFrameworkScriptFile: './jest.setup.js'
};
