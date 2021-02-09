import * as tap from 'tap';
import { readFileSync } from 'fs';
import { join } from 'path';
import { V1PodSpec } from '@kubernetes/client-node';

import { config } from '../../src/common/config';
import { IScanResult } from '../../src/scanner/types';
import * as payload from '../../src/transmitter/payload';
import { ILocalWorkloadLocator, IWorkload } from '../../src/transmitter/types';

const podSpecFixture = JSON.parse(
    readFileSync(join(__dirname, '../', 'fixtures', 'pod-spec.json'),{ encoding: 'utf8' })
) as V1PodSpec;

tap.test('constructScanResults breaks when workloadMetadata is missing items', async (t) => {
  const scannedImages: IScanResult[] = [
    {
      image: 'myImage',
      imageWithTag: 'myImage:tag',
      imageWithDigest: 'myImage@sha256:idontcarewhatissha',
      pluginResult: 'whatever1' as any,
      scanResults: [],
    },
    {
      image: 'anotherImage',
      imageWithTag: 'anotherImage:1.2.3-alpha',
      imageWithDigest: 'myImage@sha256:somuchdifferentsha256',
      pluginResult: 'whatever3' as any,
      scanResults: [],
    },
  ];

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
      imageName: 'myImage',
      imageId: 'does this matter?',
      cluster: 'grapefruit',
      revision: undefined,
      podSpec: podSpecFixture,
    },
  ];

  t.throws(() => payload.constructScanResults(scannedImages, workloadMetadata),
    'constructScanResults throws when workloadMetadata is missing items from scannedImages');
});

tap.test('constructScanResults happy flow', async (t) => {
  const scannedImages: IScanResult[] = [
    {
      image: 'myImage',
      imageWithTag: 'myImage:tag',
      imageWithDigest: 'myImage@sha256:idontcarewhatissha',
      pluginResult: 'whatever1' as any,
      scanResults: [
        { facts: [], identity: { type: 'foo' }, target: { image: 'foo' } },
      ],
    },
  ];

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
      podSpec: podSpecFixture,
    },
  ];

  // These values are populated at runtime (injected by the deployment) so we have to mock them
  // to make sure the function uses them to construct the payload (otherwise they are undefined).
  const backups = {
    namespace: config.NAMESPACE,
    version: config.MONITOR_VERSION,
  };
  config.NAMESPACE = 'b7';
  config.MONITOR_VERSION = '1.2.3';

  const payloads = payload.constructScanResults(scannedImages, workloadMetadata);

  t.equals(payloads.length, 1, 'one payload to send upstream');
  const firstPayload = payloads[0];
  t.deepEqual(
    firstPayload.scanResults,
    [{ facts: [], identity: { type: 'foo' }, target: { image: 'foo' } }],
    'scan results present in payload',
  );
  t.equals(firstPayload.imageLocator.cluster, 'grapefruit', 'cluster present in payload');
  t.equals(firstPayload.imageLocator.imageId, 'myImage', 'image ID present in payload');
  t.equals(firstPayload.imageLocator.name, 'workloadName', 'workload name present in payload');
  t.equals(firstPayload.imageLocator.type, 'type', 'workload type present in payload');

  t.deepEqual(
    firstPayload.metadata,
    {
      agentId: config.AGENT_ID,
      namespace: 'b7',
      version: '1.2.3'
    },
    'metadata is correctly returned in payload'
  );

  config.NAMESPACE = backups.namespace;
  config.MONITOR_VERSION = backups.version;
});

tap.test('constructWorkloadMetadata happy flow', async (t) => {
  const workloadWithImages: IWorkload = {
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
    podSpec: podSpecFixture,
  };

  const workloadMetadataPayload = payload.constructWorkloadMetadata(workloadWithImages);

  t.equals(workloadMetadataPayload.workloadLocator.cluster, 'grapefruit', 'cluster present in payload');
  t.equals(workloadMetadataPayload.workloadLocator.namespace, 'spacename', 'image ID present in payload');
  t.equals(workloadMetadataPayload.workloadLocator.name, 'workloadName', 'workload name present in payload');
  t.equals(workloadMetadataPayload.workloadLocator.type, 'type', 'workload type present in payload');
  t.equals(workloadMetadataPayload.workloadMetadata.revision, 1, 'revision present in metadata');
  t.ok('podSpec' in workloadMetadataPayload.workloadMetadata, 'podSpec present in metadata');
  t.equals(workloadMetadataPayload.workloadMetadata.podSpec.containers[0].resources!.limits!.memory!, '2Gi',
   'memory limit present in metadata');
  t.equals(workloadMetadataPayload.workloadMetadata.podSpec.serviceAccountName, 'snyk-monitor',
   'service account name present in metadata');
  t.ok('annotations' in workloadMetadataPayload.workloadMetadata, 'annotations present in metadata');
  t.ok('specAnnotations' in workloadMetadataPayload.workloadMetadata, 'specAnnotations present in metadata');
  t.ok('labels' in workloadMetadataPayload.workloadMetadata, 'labels present in metadata');
  t.ok('specLabels' in workloadMetadataPayload.workloadMetadata, 'specLabels present in metadata');
});

tap.test('constructDeleteWorkload happy flow', async (t) => {
  const localWorkloadLocator: ILocalWorkloadLocator = {
    name: 'wl-name',
    namespace: 'wl-namespace',
    type: 'wl-type'
  };
  const deleteWorkloadPayload = payload.constructDeleteWorkload(localWorkloadLocator);

  t.ok('workloadLocator' in deleteWorkloadPayload, 'workloadLocator present in payload');
  t.ok('agentId' in deleteWorkloadPayload, 'agentId present in payload');

  t.ok('userLocator' in deleteWorkloadPayload.workloadLocator, 'userLocator present in workloadLocator');
  t.ok('cluster' in deleteWorkloadPayload.workloadLocator, 'cluster present in workloadLocator');

  t.equals(deleteWorkloadPayload.workloadLocator.name, 'wl-name', 'matched workload name');
  t.equals(deleteWorkloadPayload.workloadLocator.namespace, 'wl-namespace', 'matched workload namespace');
  t.equals(deleteWorkloadPayload.workloadLocator.type, 'wl-type', 'matched workload type');
});
