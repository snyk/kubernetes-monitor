import * as state from '../../../src/state';
import * as transmitter from '../../../src/transmitter';
import * as scannerImages from '../../../src/scanner/images';
import * as transmitterPayload from '../../../src/transmitter/payload';

import { scanImagesAndSendResults } from '../../../src/scanner';
import { handleReadyPod } from '../../../src/supervisor/watchers/handlers/pod';
import { workloadsToScanQueue } from '../../../src/supervisor/watchers/handlers/queue';

import type { IWorkload } from '../../../src/transmitter/types';
import type { LegacyPluginResponse } from '../../../src/scanner/images/docker-plugin-shim';

describe('scan results caching', () => {
  const workload: IWorkload = {
    cluster: 'cluster',
    namespace: 'namespace',
    type: 'type',
    uid: 'uid',
    name: 'name',
    imageName: 'imageName',
    imageId: 'imageId',
    containerName: 'containerName',
    revision: 1,
    podSpec: { containers: [] },
    annotations: undefined,
    labels: undefined,
    specAnnotations: undefined,
    specLabels: undefined,
  };

  describe('when receiving workloads to scan', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('stores workload images to cache and pushes to queue when not already seen', async () => {
      // Arrange
      const queuePushMock = jest
        .spyOn(workloadsToScanQueue, 'push')
        .mockReturnValue();
      const setWorkloadImageAlreadyScannedMock = jest
        .spyOn(state, 'setWorkloadImageAlreadyScanned')
        .mockReturnValue(true);

      // Act
      const workloadMetadata: IWorkload[] = [workload];
      await handleReadyPod(workloadMetadata);

      // Assert
      expect(queuePushMock).toHaveBeenCalledWith({
        key: workload.uid,
        workloadMetadata,
        enqueueTimestampMs: expect.any(Number),
      });
      expect(setWorkloadImageAlreadyScannedMock).toHaveBeenCalledWith(
        workload,
        'imageName',
        'imageId',
      );

      setWorkloadImageAlreadyScannedMock.mockRestore();
      queuePushMock.mockRestore();
    });

    it('stores images to cache and pushes to queue when imageId is different', async () => {
      // Arrange
      const queuePushMock = jest
        .spyOn(workloadsToScanQueue, 'push')
        .mockReturnValue();
      const setWorkloadImageAlreadyScannedMock = jest
        .spyOn(state, 'setWorkloadImageAlreadyScanned')
        .mockReturnValue(true);
      const workloadWithNewImageId: IWorkload = {
        ...workload,
        imageId: 'newImageId',
      };

      // Act
      const workloadMetadata: IWorkload[] = [workloadWithNewImageId];
      await handleReadyPod(workloadMetadata);

      // Assert
      expect(queuePushMock).toHaveBeenCalledWith({
        key: workload.uid,
        workloadMetadata,
        enqueueTimestampMs: expect.any(Number),
      });
      expect(setWorkloadImageAlreadyScannedMock).toHaveBeenCalledWith(
        workloadWithNewImageId,
        'imageName',
        'newImageId',
      );

      setWorkloadImageAlreadyScannedMock.mockRestore();
      queuePushMock.mockRestore();
    });

    it('skips storing images to cache and skips pushing to queue when imageId is already seen', async () => {
      // Arrange
      state.setWorkloadImageAlreadyScanned(
        workload,
        workload.imageName,
        workload.imageId,
      );
      const queuePushMock = jest
        .spyOn(workloadsToScanQueue, 'push')
        .mockReturnValue();
      const setWorkloadImageAlreadyScannedMock = jest
        .spyOn(state, 'setWorkloadImageAlreadyScanned')
        .mockReturnValue(true);

      // Act
      const workloadMetadata: IWorkload[] = [workload];
      await handleReadyPod(workloadMetadata);

      // Assert
      expect(queuePushMock).not.toHaveBeenCalled();
      expect(setWorkloadImageAlreadyScannedMock).not.toHaveBeenCalled();

      setWorkloadImageAlreadyScannedMock.mockRestore();
      queuePushMock.mockRestore();
    });
  });

  describe('when scanning and sending scan results', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test.each([
      [
        'with cached workload state',
        `${workload.namespace}/${workload.type}/${workload.uid}`,
        undefined,
      ],
      [
        'with cached image state',
        undefined,
        `${workload.namespace}/${workload.type}/${workload.uid}/${workload.imageId}`,
      ],
      [
        'with cached workload and image state',
        `${workload.namespace}/${workload.type}/${workload.uid}`,
        `${workload.namespace}/${workload.type}/${workload.uid}/${workload.imageId}`,
      ],
    ])('%s', async (_testCaseName, workloadState, imageState) => {
      // Arrange
      const scanImagesMock = jest
        .spyOn(scannerImages, 'scanImages')
        .mockResolvedValue([
          {
            image: 'image',
            imageWithDigest:
              'image@sha256:3e46ed577bf26f1bd0bf265b25b3ac3f72831bc87edee0c9da7bb8006b9b8836',
            imageWithTag: 'image:tag',
            pluginResult: {} as LegacyPluginResponse,
            scanResults: [],
          },
        ]);
      const constructScanResultsMock = jest
        .spyOn(transmitterPayload, 'constructScanResults')
        .mockReturnValue([]);
      const sendScanResultsMock = jest.spyOn(transmitter, 'sendScanResults');

      // Act
      state.setWorkloadAlreadyScanned(workload, workloadState as any);
      state.setWorkloadImageAlreadyScanned(
        workload,
        workload.imageName,
        imageState as any,
      );

      const workloadName = 'mock';
      const pulledImages = [];
      const workloadMetadata: IWorkload[] = [workload];
      const telemetry = {};
      await scanImagesAndSendResults(
        workloadName,
        pulledImages,
        workloadMetadata,
        telemetry,
      );

      // Assert
      expect(sendScanResultsMock).toHaveBeenCalled();

      sendScanResultsMock.mockRestore();
      constructScanResultsMock.mockRestore();
      scanImagesMock.mockRestore();
    });

    it('skips sending scan results when a workload is no longer in cache', async () => {
      // Arrange
      const scanImagesMock = jest
        .spyOn(scannerImages, 'scanImages')
        .mockResolvedValue([
          {
            image: 'image',
            imageWithDigest:
              'image@sha256:3e46ed577bf26f1bd0bf265b25b3ac3f72831bc87edee0c9da7bb8006b9b8836',
            imageWithTag: 'image:tag',
            pluginResult: {} as LegacyPluginResponse,
            scanResults: [],
          },
        ]);
      const sendScanResultsMock = jest.spyOn(transmitter, 'sendScanResults');

      // Act
      state.state.workloadsAlreadyScanned.reset();
      state.state.imagesAlreadyScanned.reset();

      const workloadName = 'mock';
      const pulledImages = [];
      const workloadMetadata: IWorkload[] = [workload];
      const telemetry = {};
      await scanImagesAndSendResults(
        workloadName,
        pulledImages,
        workloadMetadata,
        telemetry,
      );

      // Assert
      expect(sendScanResultsMock).not.toHaveBeenCalled();

      sendScanResultsMock.mockRestore();
      scanImagesMock.mockRestore();
    });
  });
});
