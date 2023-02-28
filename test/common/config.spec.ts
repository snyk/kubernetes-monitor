describe('extractNamespaceName()', () => {
  const apiToken = '46766a0a-ed0b-4e91-84c8-ea1c827f2a73';
  beforeEach(() => {
    jest.resetModules();
    process.env.SNYK_SYSDIG_ENDPOINT = 'https://api/v1/images/';
    process.env.SNYK_SYSDIG_TOKEN = '1432gtrhtrw32raf';
    process.env.SNYK_SERVICE_ACCOUNT_API_TOKEN = apiToken;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.SNYK_CLUSTER_NAME;
    delete process.env.SNYK_SYSDIG_ENDPOINT;
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

      delete process.env.SNYK_SYSDIG_TOKEN;
    },
  );

  it('loads the expected configuration values', () => {
    const { config } = require('../../src/common/config');
    expect(config.AGENT_ID).toEqual(expect.any(String));
    expect(config.INTEGRATION_ID).toEqual(expect.any(String));
    expect(config.SERVICE_ACCOUNT_API_TOKEN).toEqual(apiToken);
    expect(config.CLUSTER_NAME).toEqual('Default cluster');
    expect(config.IMAGE_STORAGE_ROOT).toEqual('/var/tmp');
    expect(config.EXCLUDED_NAMESPACES).toBeNull();
    expect(config.HTTPS_PROXY).toBeUndefined();
    expect(config.HTTP_PROXY).toBeUndefined();
    expect(config.NO_PROXY).toBeUndefined();
    expect(config.USE_KEEPALIVE).toEqual(true);
    expect(config.SKIP_K8S_JOBS).toEqual(false);
    expect(config.WORKERS_COUNT).toEqual(5);
    expect(config.SKOPEO_COMPRESSION_LEVEL).toEqual(6);
    expect(config.SYSDIG_ENDPOINT).toEqual('https://api/v1/images/');
    expect(config.SYSDIG_TOKEN).toEqual('1432gtrhtrw32raf');
  });

  it('cannot load sysdig API and JWT values if it is not enabled', () => {
    delete process.env.SNYK_SYSDIG_ENDPOINT;
    delete process.env.SNYK_SYSDIG_TOKEN;
    const { config } = require('../../src/common/config');
    expect(config.SYSDIG_ENDPOINT).toBeUndefined();
    expect(config.SYSDIG_TOKEN).toBeUndefined();
  });
});
