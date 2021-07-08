describe('extractNamespaceName()', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    [
      'cluster name with /',
      {
        clusterNameEnvVar: 'cluster/name',
        wantClusterName: 'clustername',
        consoleLogCalledTimes: 1,
      },
    ],
    [
      'cluster name with  more than one /',
      {
        clusterNameEnvVar: 'cluster/name/slash',
        wantClusterName: 'clusternameslash',
        consoleLogCalledTimes: 1,
      },
    ],
    [
      'cluster name without /',
      {
        clusterNameEnvVar: 'normal cluster name',
        wantClusterName: 'normal cluster name',
        consoleLogCalledTimes: 0,
      },
    ],
    [
      'no cluster name set',
      {
        clusterNameEnvVar: '',
        wantClusterName: 'Default cluster',
        consoleLogCalledTimes: 0,
      },
    ],
  ])(
    '%s',
    (
      _testCaseName,
      { clusterNameEnvVar, wantClusterName, consoleLogCalledTimes },
    ) => {
      if (clusterNameEnvVar) {
        process.env.SNYK_CLUSTER_NAME = clusterNameEnvVar;
      }

      const consoleSpy = jest.spyOn(console, 'log').mockReturnValue();

      const { config } = require('../../src/common/config');
      expect(config.CLUSTER_NAME).toBe(wantClusterName);
      expect(consoleSpy).toHaveBeenCalledTimes(consoleLogCalledTimes);

      delete process.env.SNYK_CLUSTER_NAME;
    },
  );
});
