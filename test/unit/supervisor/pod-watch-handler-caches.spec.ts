import * as async from 'async';
import * as fs from 'fs';
import sleep from 'sleep-promise';
import * as YAML from 'yaml';

// NOTE: Very important that the mock is set up before application code is imported!
let pushCallCount = 0;
const asyncQueueSpy = jest
  .spyOn(async, 'queue')
  .mockReturnValue({ error: () => {}, push: () => pushCallCount++ } as any);

import { V1PodSpec, V1Pod } from '@kubernetes/client-node';
import { IWorkload } from '../../../src/transmitter/types';
import * as metadataExtractor from '../../../src/supervisor/metadata-extractor';
import * as pod from '../../../src/supervisor/watchers/handlers/pod';

describe('image and workload image cache', () => {
  const podSpecFixture = fs.readFileSync(
    './test/fixtures/pod-spec.json',
    'utf8',
  );
  const podSpec: V1PodSpec = YAML.parse(podSpecFixture);
  const workloadMetadata: IWorkload[] = [
    {
      type: 'type',
      name: 'workloadName',
      namespace: 'spacename',
      labels: undefined,
      annotations: undefined,
      uid: 'udi',
      specLabels: undefined,
      specAnnotations: undefined,
      containerName: 'contener',
      imageName: 'myImage:tag',
      imageId: 'does this matter?',
      cluster: 'grapefruit',
      revision: 1,
      podSpec,
    },
  ];

  const buildMetadataSpy = jest
    .spyOn(metadataExtractor, 'buildMetadataForWorkload')
    .mockResolvedValue(workloadMetadata);

  afterAll(() => {
    asyncQueueSpy.mockRestore();
    buildMetadataSpy.mockRestore();
  });

  const podFixture = fs.readFileSync(
    './test/fixtures/sidecar-containers/pod.yaml',
    'utf8',
  );
  const podObject: V1Pod = YAML.parse(podFixture);

  it('pushed data to send', async () => {
    await pod.podWatchHandler(podObject);
    await sleep(500);
    expect(pushCallCount).toEqual(1);
  });

  it('cached info, no data pushed to send', async () => {
    await pod.podWatchHandler(podObject);
    await sleep(500);
    expect(pushCallCount).toEqual(1);
  });

  it('new image parsed, workload is cached', async () => {
    workloadMetadata[0].imageId = 'newImageName';
    await pod.podWatchHandler(podObject);
    await sleep(1000);
    expect(pushCallCount).toEqual(2);
  });
});
