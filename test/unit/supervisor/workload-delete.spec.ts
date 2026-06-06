// Mock modules before imports
const mockSendDeleteWorkloadRequest = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/scanner', () => ({
  sendDeleteWorkloadRequest: mockSendDeleteWorkloadRequest,
}));

const mockAddPendingDelete = jest.fn().mockReturnValue(true);
const mockGetGracePeriodAnnotation = jest.fn();
jest.mock('../../../src/supervisor/pending-deletes', () => ({
  addPendingDelete: mockAddPendingDelete,
  getGracePeriodAnnotation: mockGetGracePeriodAnnotation,
}));

jest.mock('../../../src/common/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { config } from '../../../src/common/config';
import { deleteWorkload } from '../../../src/supervisor/watchers/handlers/workload';
import { IKubeObjectMetadata } from '../../../src/supervisor/types';

function makeWorkloadMetadata(
  overrides: Partial<{
    name: string;
    namespace: string;
    kind: string;
    annotations: Record<string, string>;
    ownerRefs: Array<{ kind: string; name: string }>;
  }> = {},
): IKubeObjectMetadata {
  return {
    kind: overrides.kind || 'Deployment',
    objectMeta: {
      name: overrides.name || 'test-workload',
      namespace: overrides.namespace || 'default',
      annotations: overrides.annotations,
    },
    specMeta: {},
    podSpec: { containers: [] },
    ownerRefs: overrides.ownerRefs as any,
  } as IKubeObjectMetadata;
}

describe('deleteWorkload()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGracePeriodAnnotation.mockReturnValue(undefined);
  });

  describe('feature disabled (backward compatibility)', () => {
    beforeAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = false;
    });

    afterAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = false;
    });

    it('always sends immediate delete, ignoring annotation', async () => {
      mockGetGracePeriodAnnotation.mockReturnValue('7d');
      const metadata = makeWorkloadMetadata({
        annotations: { 'snyk.io/delete-grace-period': '7d' },
      });

      await deleteWorkload(metadata, 'test-workload');

      expect(mockSendDeleteWorkloadRequest).toHaveBeenCalledWith(
        'test-workload',
        { namespace: 'default', type: 'Deployment', name: 'test-workload' },
      );
      expect(mockAddPendingDelete).not.toHaveBeenCalled();
    });
  });

  describe('feature enabled', () => {
    beforeAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = true;
    });

    afterAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = false;
    });

    it('defers delete when annotation is present', async () => {
      mockGetGracePeriodAnnotation.mockReturnValue('7d');
      const metadata = makeWorkloadMetadata({
        name: 'my-app',
        namespace: 'staging',
        kind: 'StatefulSet',
        annotations: { 'snyk.io/delete-grace-period': '7d' },
      });

      await deleteWorkload(metadata, 'my-app');

      expect(mockAddPendingDelete).toHaveBeenCalledWith(
        { namespace: 'staging', type: 'StatefulSet', name: 'my-app' },
        'my-app',
        '7d',
      );
      expect(mockSendDeleteWorkloadRequest).not.toHaveBeenCalled();
    });

    it('sends immediate delete when no annotation is present', async () => {
      mockGetGracePeriodAnnotation.mockReturnValue(undefined);
      const metadata = makeWorkloadMetadata();

      await deleteWorkload(metadata, 'test-workload');

      expect(mockSendDeleteWorkloadRequest).toHaveBeenCalledTimes(1);
      expect(mockAddPendingDelete).not.toHaveBeenCalled();
    });

    it('sends immediate delete when addPendingDelete is not triggered (annotation undefined)', async () => {
      // Verifies the opt-in contract: annotation absence = old behavior
      mockGetGracePeriodAnnotation.mockReturnValue(undefined);
      const metadata = makeWorkloadMetadata({
        annotations: { 'some-other/annotation': 'value' },
      });

      await deleteWorkload(metadata, 'test-workload');

      expect(mockSendDeleteWorkloadRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('ownerRefs handling', () => {
    beforeAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = true;
    });

    afterAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = false;
    });

    it('skips workloads with ownerRefs (deduplication)', async () => {
      mockGetGracePeriodAnnotation.mockReturnValue('7d');
      const metadata = makeWorkloadMetadata({
        ownerRefs: [{ kind: 'Deployment', name: 'parent' }],
        annotations: { 'snyk.io/delete-grace-period': '7d' },
      });

      await deleteWorkload(metadata, 'child-replicaset');

      expect(mockSendDeleteWorkloadRequest).not.toHaveBeenCalled();
      expect(mockAddPendingDelete).not.toHaveBeenCalled();
    });

    test.each([
      ['empty array', []],
      ['undefined', undefined],
    ])('processes workloads when ownerRefs is %s', async (_desc, ownerRefs) => {
      const metadata: IKubeObjectMetadata = {
        kind: 'Deployment',
        objectMeta: { name: 'top-level', namespace: 'default', annotations: undefined },
        specMeta: {},
        podSpec: { containers: [] },
        ownerRefs: ownerRefs as any,
      } as any;

      await deleteWorkload(metadata, 'top-level');

      expect(mockSendDeleteWorkloadRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('error resilience', () => {
    beforeAll(() => {
      config.DELETE_GRACE_PERIOD_ENABLED = false;
    });

    it('swallows errors from sendDeleteWorkloadRequest', async () => {
      mockSendDeleteWorkloadRequest.mockRejectedValueOnce(new Error('network'));
      const metadata = makeWorkloadMetadata();

      await expect(deleteWorkload(metadata, 'test')).resolves.not.toThrow();
    });
  });
});
