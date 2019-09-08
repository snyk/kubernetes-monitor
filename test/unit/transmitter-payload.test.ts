import * as tap from 'tap';

import imageScanner = require('../../src/kube-scanner/image-scanner');
import payload = require('../../src/transmitter/payload');
import transmitterTypes = require('../../src/transmitter/types');

tap.test('constructHomebaseWorkloadPayloads breaks when workloadMetadata is missing items', async (t) => {
  const scannedImages: imageScanner.IScanResult[] = [
    {
      image: 'myImage',
      imageWithTag: 'myImage:tag',
      pluginResult: 'whatever1',
    },
    {
      image: 'anotherImage',
      imageWithTag: 'anotherImage:1.2.3-alpha',
      pluginResult: 'whatever3',
    },
  ];

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
      imageName: 'myImage',
      imageId: 'does this matter?',
      cluster: 'grapefruit',
      revision: undefined,
    },
  ];

  t.throws(() => payload.constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata),
    'constructHomebaseWorkloadPayloads throws when workloadMetadata is missing items from scannedImages');
});

tap.test('constructHomebaseWorkloadPayloads happy flow', async (t) => {
  const scannedImages: imageScanner.IScanResult[] = [
    {
      image: 'myImage',
      imageWithTag: 'myImage:tag',
      pluginResult: 'whatever1',
    },
  ];

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
    },
  ];

  const payloads = payload.constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata);

  t.equals(payloads.length, 1, 'one payload to send to Homebase');
  t.equals(payloads[0].dependencyGraph, JSON.stringify('whatever1'), 'dependency graph present in payload');
  t.equals(payloads[0].imageLocator.cluster, 'grapefruit', 'cluster present in payload');
  t.equals(payloads[0].imageLocator.imageId, 'myImage', 'image ID present in payload');
  t.equals(payloads[0].imageLocator.name, 'workloadName', 'workload name present in payload');
  t.equals(payloads[0].imageLocator.type, 'type', 'workload type present in payload');
});
