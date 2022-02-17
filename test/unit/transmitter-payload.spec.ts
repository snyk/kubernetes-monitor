import { readFileSync } from 'fs';
import { join } from 'path';
import { V1PodSpec } from '@kubernetes/client-node';

import { config } from '../../src/common/config';
import { IScanResult } from '../../src/scanner/types';
import * as payload from '../../src/transmitter/payload';
import {
  IDeleteWorkloadPayload,
  IImageLocator,
  ILocalWorkloadLocator,
  IRuntimeDataPayload,
  IRuntimeImage,
  IWorkload,
  IWorkloadLocator,
  IWorkloadMetadata,
} from '../../src/transmitter/types';

const podSpecFixture = JSON.parse(
  readFileSync(join(__dirname, '../', 'fixtures', 'pod-spec.json'), {
    encoding: 'utf8',
  }),
) as V1PodSpec;

describe('transmitter payload tests', () => {
  test.concurrent(
    'constructScanResults breaks when workloadMetadata is missing items',
    async () => {
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

      const telemetry: Record<string, number> = {};

      expect(() =>
        payload.constructScanResults(
          scannedImages,
          workloadMetadata,
          telemetry,
        ),
      ).toThrow();
    },
  );

  test.concurrent('constructScanResults happy flow', async () => {
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
    const telemetry: Record<string, number> = {};

    // These values are populated at runtime (injected by the deployment) so we have to mock them
    // to make sure the function uses them to construct the payload (otherwise they are undefined).
    const backups = {
      namespace: config.WATCH_NAMESPACE,
      version: config.MONITOR_VERSION,
    };
    config.WATCH_NAMESPACE = 'b7';
    config.MONITOR_VERSION = '1.2.3';

    const payloads = payload.constructScanResults(
      scannedImages,
      workloadMetadata,
      telemetry,
    );
    expect(payloads).toHaveLength(1);

    const firstPayload = payloads[0];
    expect(firstPayload.scanResults).toEqual([
      { facts: [], identity: { type: 'foo' }, target: { image: 'foo' } },
    ]);
    expect(firstPayload.imageLocator).toEqual(
      expect.objectContaining<Partial<IImageLocator>>({
        cluster: 'grapefruit',
        imageId: 'myImage',
        name: 'workloadName',
        type: 'type',
      }),
    );

    config.WATCH_NAMESPACE = backups.namespace;
    config.MONITOR_VERSION = backups.version;
  });

  test.concurrent('constructWorkloadMetadata happy flow', async () => {
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

    const workloadMetadataPayload =
      payload.constructWorkloadMetadata(workloadWithImages);
    expect(workloadMetadataPayload.workloadLocator).toEqual(
      expect.objectContaining<Partial<IWorkloadLocator>>({
        cluster: 'grapefruit',
        namespace: 'spacename',
        name: 'workloadName',
        type: 'type',
      }),
    );

    expect(workloadMetadataPayload.workloadMetadata).toEqual(
      expect.objectContaining<Partial<IWorkloadMetadata>>({
        podSpec: expect.any(Object),
        annotations: undefined,
        specAnnotations: undefined,
        labels: undefined,
        specLabels: undefined,
      }),
    );
    expect(workloadMetadataPayload.workloadMetadata.revision).toEqual(1);

    expect(
      workloadMetadataPayload.workloadMetadata.podSpec.containers[0].resources
        ?.limits?.memory,
    ).toEqual('2Gi');
    expect(
      workloadMetadataPayload.workloadMetadata.podSpec.serviceAccountName,
    ).toEqual('snyk-monitor');
  });

  test.concurrent('constructDeleteWorkload happy flow', async () => {
    const localWorkloadLocator: ILocalWorkloadLocator = {
      name: 'wl-name',
      namespace: 'wl-namespace',
      type: 'wl-type',
    };
    const deleteWorkloadPayload =
      payload.constructDeleteWorkload(localWorkloadLocator);
    expect(deleteWorkloadPayload).toEqual<IDeleteWorkloadPayload>({
      workloadLocator: expect.any(Object),
      agentId: expect.any(String),
    });

    expect(deleteWorkloadPayload.workloadLocator).toEqual<IWorkloadLocator>({
      userLocator: expect.any(String),
      cluster: expect.any(String),
      name: 'wl-name',
      namespace: 'wl-namespace',
      type: 'wl-type',
    });
  });

  test.concurrent('constructRuntimeData happy flow', async () => {
    const runtimeDataPayload = payload.constructRuntimeData([
      {
        imageID: 'something',
        namespace: 'sysdig',
        workloadName: 'workload',
        workloadKind: 'deployment',
        container: 'box',
        packages: [],
      },
    ]);
    expect(runtimeDataPayload).toEqual<IRuntimeDataPayload>({
      identity: {
        type: 'sysdig',
      },
      target: {
        userLocator: expect.any(String),
        cluster: 'Default cluster',
        agentId: expect.any(String),
      },
      facts: [
        {
          type: 'loadedPackages',
          data: [
            {
              imageID: 'something',
              namespace: 'sysdig',
              workloadName: 'workload',
              workloadKind: 'Deployment',
              container: 'box',
              packages: [],
            },
          ],
        },
      ],
    });
  });

  test.concurrent(
    'constructRuntimeData with excluded namespace happy flow',
    async () => {
      config.EXCLUDED_NAMESPACES = ['test'];
      const runtimeDataPayload = payload.constructRuntimeData([
        {
          imageID: 'something',
          namespace: 'sysdig',
          workloadName: 'workload',
          workloadKind: 'deployment',
          container: 'box',
          packages: [],
        },
        {
          imageID: 'something',
          namespace: 'test',
          workloadName: 'workload',
          workloadKind: 'deployment',
          container: 'box',
          packages: [],
        },
      ]);
      expect(runtimeDataPayload).toEqual<IRuntimeDataPayload>({
        identity: {
          type: 'sysdig',
        },
        target: {
          userLocator: expect.any(String),
          cluster: 'Default cluster',
          agentId: expect.any(String),
        },
        facts: [
          {
            type: 'loadedPackages',
            data: [
              {
                imageID: 'something',
                namespace: 'sysdig',
                workloadName: 'workload',
                workloadKind: 'Deployment',
                container: 'box',
                packages: [],
              },
            ],
          },
        ],
      });
    },
  );
});
