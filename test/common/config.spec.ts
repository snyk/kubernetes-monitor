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

  it('loads the expected configuration values', () => {
    const { config } = require('../../src/common/config');
    expect(config.AGENT_ID).toEqual(expect.any(String));
    expect(config.INTEGRATION_ID).toEqual(expect.any(String));
    expect(config.CLUSTER_NAME).toEqual('Default cluster');
    expect(config.IMAGE_STORAGE_ROOT).toEqual('/var/tmp');
    expect(config.EXCLUDED_NAMESPACES).toBeNull();
    expect(config.HTTPS_PROXY).toBeUndefined();
    expect(config.HTTP_PROXY).toBeUndefined();
    expect(config.NO_PROXY).toBeUndefined();
    expect(config.SKIP_K8S_JOBS).toEqual(false);
    expect(config.WORKLOADS_TO_SCAN_QUEUE_WORKER_COUNT).toEqual(10);
  });
});
