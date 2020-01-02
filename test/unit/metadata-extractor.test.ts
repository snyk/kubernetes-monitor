import * as tap from 'tap';
import * as fs from 'fs';
import * as YAML from 'yaml';

import { V1OwnerReference, V1Pod, V1Deployment } from '@kubernetes/client-node';
import * as supervisorTypes from '../../src/supervisor/types';

import * as metadataExtractor from '../../src/supervisor/metadata-extractor';

tap.test('isPodAssociatedWithParent', async (t) => {
  const mockPodWithoutMetadata = {};
  t.notOk(metadataExtractor.isPodAssociatedWithParent(mockPodWithoutMetadata as V1Pod),
    'pod with no object data is not associated with parent');

  const mockPodWithEmptyMetadata = {metadata: {}};
  const isPodWithEmptyMetadataAssociatedWithParent = metadataExtractor.isPodAssociatedWithParent(
    mockPodWithEmptyMetadata as V1Pod);
  t.notOk(isPodWithEmptyMetadataAssociatedWithParent, 'pod with empty metadata is not associated with parent');

  const mockPodWithEmptyOwnerReferences = {metadata: {ownerReferences: [] as V1OwnerReference[]}};
  const isPodWithEmptyOwnerReferenceAssociatedWithParent = metadataExtractor.isPodAssociatedWithParent(
    mockPodWithEmptyOwnerReferences as V1Pod);
  t.notOk(isPodWithEmptyOwnerReferenceAssociatedWithParent,
    'pod with empty owner references is not associated with parent');

  const mockPodWithOwnerReferencesWithoutKind = {metadata: {ownerReferences: [
    {} as V1OwnerReference,
  ] as V1OwnerReference[]}};
  const isPodWithOwnerReferencesWithoutKindAssociatedWithParent = metadataExtractor.isPodAssociatedWithParent(
    mockPodWithOwnerReferencesWithoutKind as V1Pod);
  t.notOk(isPodWithOwnerReferencesWithoutKindAssociatedWithParent,
    'pod with owner references without kind is not associated with parent');

  const mockPodWithOwnerReferencesWithEmptyKInd = {metadata: {ownerReferences: [
    {kind: ''} as V1OwnerReference,
  ] as V1OwnerReference[]}};
  const isPodWithOwnerReferencesWithEmptyKindAssociatedWithParent = metadataExtractor.isPodAssociatedWithParent(
    mockPodWithOwnerReferencesWithEmptyKInd as V1Pod);
  t.notOk(isPodWithOwnerReferencesWithEmptyKindAssociatedWithParent,
    'pod with owner references with empty kind is not associated with parent');

  const mockPodWithOwnerReferencesWithKind = {metadata: {ownerReferences: [
    {kind: 'BUTTER'} as V1OwnerReference,
  ] as V1OwnerReference[]}};
  const isPodWithOwnerReferencesWithKindAssociatedWithParent = metadataExtractor.isPodAssociatedWithParent(
    mockPodWithOwnerReferencesWithKind as V1Pod);
  t.ok(isPodWithOwnerReferencesWithKindAssociatedWithParent,
    'pod with owner references with kind is associated with parent');

  const mockPodWithMixedOwnerReferences = {metadata: {ownerReferences: [
    {} as V1OwnerReference,
    {kind: ''} as V1OwnerReference,
    {kind: 'BUTTER'} as V1OwnerReference,
  ] as V1OwnerReference[]}};
  const isPodWithMixedOwnerReferencesAssociatedWithParent = metadataExtractor.isPodAssociatedWithParent(
    mockPodWithMixedOwnerReferences as V1Pod);
  t.ok(isPodWithMixedOwnerReferencesAssociatedWithParent,
    'pod with some owner references with kind is associated with parent');
});

tap.test('buildImageMetadata', async (t) => {
  const deploymentFixture = fs.readFileSync('./test/fixtures/sidecar-containers/deployment.yaml', 'utf8');
  const deploymentObject: V1Deployment = YAML.parse(deploymentFixture);
  const podFixture = fs.readFileSync('./test/fixtures/sidecar-containers/pod.yaml', 'utf8');
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

  t.ok(Array.isArray(imageMetadataResult), 'returns an array');
  t.equals(
    imageMetadataResult.length,
    1,
    'the size of the container status array that also appears in the spec',
  );
  t.equals(imageMetadataResult[0].type, 'Deployment', 'with the workload type of the parent');
  t.equals(
    imageMetadataResult[0].imageId,
    'docker-pullable://eu.gcr.io/cookie/hello-world@sha256:1ac413b2756364b7b856c64d557fdedb97a4ba44ca16fc656e08881650848fe2',
    'the image ID of the first container'
  );
  t.equals(
    imageMetadataResult[0].imageName,
    'eu.gcr.io/cookie/hello-world:1.20191125.132107-4664980',
    'the image name of the first container'
  );
});
