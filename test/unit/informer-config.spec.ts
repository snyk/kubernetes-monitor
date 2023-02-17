import { WorkloadKind } from '../../src/supervisor/types';

describe('workloadWatchMetadata is loaded based on config.SCAN_NETWORKING_RESOURCES', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  test('ensure networking resources are not loaded when config.SCAN_NETWORKING_RESOURCES is not true', async () => {
    process.env.SCAN_NETWORKING_RESOURCES = '';
    const {
      workloadWatchMetadata,
    } = require('../../src/supervisor/watchers/handlers/informer-config');

    // Workload resources such as Deployment should be loaded
    expect(workloadWatchMetadata[WorkloadKind.Deployment]).toBeDefined();
    // Networking resources should not be loaded
    expect(workloadWatchMetadata[WorkloadKind.Service]).toBeUndefined();
    expect(workloadWatchMetadata[WorkloadKind.Ingress]).toBeUndefined();
  });
  test('ensure networking resources are loaded when config.SCAN_NETWORKING_RESOURCES is true', async () => {
    process.env.SCAN_NETWORKING_RESOURCES = 'true';
    const {
      workloadWatchMetadata,
    } = require('../../src/supervisor/watchers/handlers/informer-config');
    // Workload resources such as Deployment should be loaded
    expect(workloadWatchMetadata[WorkloadKind.Deployment]).toBeDefined();
    // Networking resources should be loaded because of SCAN_NETWORKING_RESOURCES
    expect(workloadWatchMetadata[WorkloadKind.Service]).toBeDefined();
    expect(workloadWatchMetadata[WorkloadKind.Ingress]).toBeDefined();
  });
});
