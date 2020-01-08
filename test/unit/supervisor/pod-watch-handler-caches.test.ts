import * as tap from 'tap';
import sinon = require('sinon');
import * as sleep from 'sleep-promise';
import * as fs from 'fs';
import * as YAML from 'yaml';
import async = require('async');

import { V1PodSpec, V1Pod } from '@kubernetes/client-node';
import transmitterTypes = require('../../../src/transmitter/types');
import * as metadataExtractor from '../../../src/supervisor/metadata-extractor';

let pushCallCount = 0;
sinon.stub(async, 'queue').returns({ error: () => { }, push: () => pushCallCount++ } as any);

import * as pod from '../../../src/supervisor/watchers/handlers/pod';

tap.test('image and workload image cache', async (t) => {
  const podSpecFixture = fs.readFileSync('./test/fixtures/pod-spec.json', 'utf8');
  const podSpec: V1PodSpec = YAML.parse(podSpecFixture);
  const workloadMetadata: transmitterTypes.IWorkload[] = [
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

  sinon.stub(metadataExtractor, 'buildMetadataForWorkload').resolves(workloadMetadata);

  t.teardown(() => {
    (async['queue'] as any).restore();
    (metadataExtractor['buildMetadataForWorkload'] as any).restore();
  });

  const podFixture = fs.readFileSync('./test/fixtures/sidecar-containers/pod.yaml', 'utf8');
  const podObject: V1Pod = YAML.parse(podFixture);
  await pod.podWatchHandler(podObject);
  await sleep(500);
  t.equals(pushCallCount, 2, 'pushed data to send');

  await pod.podWatchHandler(podObject);
  await sleep(500);
  t.equals(pushCallCount, 2, 'cached info, no data pushed to send');

  workloadMetadata[0].imageId = 'newImageName';
  await pod.podWatchHandler(podObject);
  await sleep(1000);
  t.equals(pushCallCount, 3, 'new image parsed, workload is cached');
});
