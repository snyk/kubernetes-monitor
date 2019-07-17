import * as tap from 'tap';

import { V1OwnerReference, V1Pod } from '@kubernetes/client-node';

import metadataExtractor = require('../../src/lib/kube-scanner/metadata-extractor');

tap.test('isPodAssociatedWithParent', async (t) => {
  const mockPodWithoutMetadata = {};
  t.throws(() => metadataExtractor.isPodAssociatedWithParent(mockPodWithoutMetadata as V1Pod),
    'isPodAssociatedWithParent throws an error on pod without metadata');

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

tap.test('extractApiGroup', async (t) => {
  const mockEmptyOwnerReferences = {} as V1Pod;
  t.equals(
    metadataExtractor.extractApiGroup(mockEmptyOwnerReferences.apiVersion),
    '',
    'owner resource with empty metadata is not associated with group',
  );
  const mockPodWithKind = {kind: 'Pod', apiVersion: 'v1'} as V1OwnerReference;
  t.equals(
    metadataExtractor.extractApiGroup(mockPodWithKind.apiVersion),
    '',
    'pod with kind and version is not associated with group',
  );
  const mockOwnerReferencesWithKindAndVersion = {kind: 'Deployment', apiVersion: 'apps/v1'} as V1OwnerReference;
  t.equals(
    metadataExtractor.extractApiGroup(mockOwnerReferencesWithKindAndVersion.apiVersion),
    'apps',
    'owner resource with kind and version is associated with group',
  );
});
