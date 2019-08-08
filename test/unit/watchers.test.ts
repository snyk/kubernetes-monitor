import * as tap from 'tap';
import { V1Namespace } from '@kubernetes/client-node';

import namespaces = require('../../src/kube-scanner/watchers/namespaces');

tap.test('extractNamespaceName', async (t) => {
  const namespaceEmpty = {} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceEmpty),
    'extractNamespaceName throws on empty input');

  const namespaceMetadataEmpty = {metadata: {}} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceMetadataEmpty),
    'extractNamespaceName throws on empty metadata');

  const namespaceNameUndefined = {metadata: {name: undefined}} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceNameUndefined),
    'extractNamespaceName throws on undefined name');

  const namespaceNameFalsy = {metadata: {name: ''}} as V1Namespace;
  t.throws(() => namespaces.extractNamespaceName(namespaceNameFalsy),
    'extractNamespaceName throws on empty name');

  const namespaceNameExists = {metadata: {name: 'literally anything else'}} as V1Namespace;
  t.equals(namespaces.extractNamespaceName(namespaceNameExists), 'literally anything else',
    'extractNamespaceName returns namespace.metadata.name');
});

tap.test('isKubernetesInternalNamespace', async (t) => {
  t.ok(namespaces.isKubernetesInternalNamespace('kube-node-lease'),
    'kube-node-lease is a k8s internal namespace');
  t.ok(namespaces.isKubernetesInternalNamespace('kube-public'),
    'kube-public is a k8s internal namespace');
  t.ok(namespaces.isKubernetesInternalNamespace('kube-system'),
    'kube-system is a k8s internal namespace');
  t.notOk(namespaces.isKubernetesInternalNamespace('kube-node-lease-'),
    'kube-node-lease- is not a k8s internal namespace');
  t.notOk(namespaces.isKubernetesInternalNamespace('node-lease'),
    'kubenode-lease is not a k8s internal namespace');
  t.notOk(namespaces.isKubernetesInternalNamespace('snyk-monitor'),
    'snyk-monitor is not a k8s internal namespace');
  t.notOk(namespaces.isKubernetesInternalNamespace('egg'),
    'egg is not a k8s internal namespace');
  t.notOk(namespaces.isKubernetesInternalNamespace(''),
    'empty string is not a k8s internal namespace');
  t.notOk(namespaces.isKubernetesInternalNamespace(undefined as unknown as string),
    'undefined is not a k8s internal namespace');
});
