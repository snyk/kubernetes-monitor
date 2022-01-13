import * as fs from 'fs';
import * as YAML from 'yaml';

import { V1OwnerReference, V1Pod, V1Deployment } from '@kubernetes/client-node';
import * as supervisorTypes from '../../../src/supervisor/types';

import * as metadataExtractor from '../../../src/supervisor/metadata-extractor';
import * as transmitterTypes from '../../../src/transmitter/types';

describe('metadata extractor tests', () => {
  test.concurrent('isPodAssociatedWithParent', async () => {
    const mockPodWithoutMetadata = {};
    expect(
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithoutMetadata as V1Pod,
      ),
    ).toEqual(false);

    const mockPodWithEmptyMetadata = { metadata: {} };
    const isPodWithEmptyMetadataAssociatedWithParent =
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithEmptyMetadata as V1Pod,
      );
    expect(isPodWithEmptyMetadataAssociatedWithParent).toEqual(false);

    const mockPodWithEmptyOwnerReferences = {
      metadata: { ownerReferences: [] as V1OwnerReference[] },
    };
    const isPodWithEmptyOwnerReferenceAssociatedWithParent =
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithEmptyOwnerReferences as V1Pod,
      );
    expect(isPodWithEmptyOwnerReferenceAssociatedWithParent).toEqual(false);

    const mockPodWithOwnerReferencesWithoutKind = {
      metadata: {
        ownerReferences: [{} as V1OwnerReference] as V1OwnerReference[],
      },
    };
    const isPodWithOwnerReferencesWithoutKindAssociatedWithParent =
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithOwnerReferencesWithoutKind as V1Pod,
      );
    expect(isPodWithOwnerReferencesWithoutKindAssociatedWithParent).toEqual(
      false,
    );

    const mockPodWithOwnerReferencesWithEmptyKInd = {
      metadata: {
        ownerReferences: [
          { kind: '' } as V1OwnerReference,
        ] as V1OwnerReference[],
      },
    };
    const isPodWithOwnerReferencesWithEmptyKindAssociatedWithParent =
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithOwnerReferencesWithEmptyKInd as V1Pod,
      );
    expect(isPodWithOwnerReferencesWithEmptyKindAssociatedWithParent).toEqual(
      false,
    );

    const mockPodWithOwnerReferencesWithKind = {
      metadata: {
        ownerReferences: [
          { kind: 'BUTTER' } as V1OwnerReference,
        ] as V1OwnerReference[],
      },
    };
    const isPodWithOwnerReferencesWithKindAssociatedWithParent =
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithOwnerReferencesWithKind as V1Pod,
      );
    expect(isPodWithOwnerReferencesWithKindAssociatedWithParent).toEqual(true);

    const mockPodWithMixedOwnerReferences = {
      metadata: {
        ownerReferences: [
          {} as V1OwnerReference,
          { kind: '' } as V1OwnerReference,
          { kind: 'BUTTER' } as V1OwnerReference,
        ] as V1OwnerReference[],
      },
    };
    const isPodWithMixedOwnerReferencesAssociatedWithParent =
      metadataExtractor.isPodAssociatedWithParent(
        mockPodWithMixedOwnerReferences as V1Pod,
      );
    expect(isPodWithMixedOwnerReferencesAssociatedWithParent).toEqual(true);
  });

  test.concurrent('buildImageMetadata', async () => {
    const deploymentFixture = fs.readFileSync(
      './test/fixtures/sidecar-containers/deployment.yaml',
      'utf8',
    );
    const deploymentObject: V1Deployment = YAML.parse(deploymentFixture);
    const podFixture = fs.readFileSync(
      './test/fixtures/sidecar-containers/pod.yaml',
      'utf8',
    );
    const podObject: V1Pod = YAML.parse(podFixture);

    const deploymentWeirdWrapper: supervisorTypes.IKubeObjectMetadata = {
      kind: 'Deployment',
      objectMeta: deploymentObject.metadata!,
      specMeta: deploymentObject.spec!.template.metadata!,
      ownerRefs: deploymentObject.metadata!.ownerReferences,
      podSpec: deploymentObject.spec!.template.spec!,
    };

    const imageMetadataResult = metadataExtractor.buildImageMetadata(
      deploymentWeirdWrapper,
      podObject.status!.containerStatuses!,
    );

    expect(Array.isArray(imageMetadataResult)).toEqual(true);
    expect(imageMetadataResult).toHaveLength(1);
    expect(imageMetadataResult[0]).toEqual(
      expect.objectContaining<Partial<transmitterTypes.IWorkload>>({
        type: 'Deployment',
        imageId:
          'docker-pullable://eu.gcr.io/cookie/hello-world@sha256:1ac413b2756364b7b856c64d557fdedb97a4ba44ca16fc656e08881650848fe2',
        imageName: 'eu.gcr.io/cookie/hello-world:1.20191125.132107-4664980',
      }),
    );
    const container = imageMetadataResult[0].podSpec.containers[0];

    expect(container.args).toBeUndefined();
    expect(container.command).toBeUndefined();
    expect(container.env).toBeUndefined();
  });
});
