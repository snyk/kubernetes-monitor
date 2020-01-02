import * as tap from 'tap';
import { V1Namespace } from '@kubernetes/client-node';

import watchers = require('../../src/supervisor/watchers');

tap.test('extractNamespaceName', async (t) => {
  const namespaceEmpty = {} as V1Namespace;
  t.throws(() => watchers.extractNamespaceName(namespaceEmpty),
    'extractNamespaceName throws on empty input');

  const namespaceMetadataEmpty = {metadata: {}} as V1Namespace;
  t.throws(() => watchers.extractNamespaceName(namespaceMetadataEmpty),
    'extractNamespaceName throws on empty metadata');

  const namespaceNameUndefined = {metadata: {name: undefined}} as V1Namespace;
  t.throws(() => watchers.extractNamespaceName(namespaceNameUndefined),
    'extractNamespaceName throws on undefined name');

  const namespaceNameFalsy = {metadata: {name: ''}} as V1Namespace;
  t.throws(() => watchers.extractNamespaceName(namespaceNameFalsy),
    'extractNamespaceName throws on empty name');

  const namespaceNameExists = {metadata: {name: 'literally anything else'}} as V1Namespace;
  t.equals(watchers.extractNamespaceName(namespaceNameExists), 'literally anything else',
    'extractNamespaceName returns namespace.metadata.name');
});

tap.test('isKubernetesInternalNamespace', async (t) => {
  t.ok(watchers.isKubernetesInternalNamespace('kube-node-lease'),
    'kube-node-lease is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('kube-public'),
    'kube-public is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('kube-system'),
    'kube-system is a k8s internal namespace');
  t.notOk(watchers.isKubernetesInternalNamespace('kube-node-lease-'),
    'kube-node-lease- is not a k8s internal namespace');
  t.notOk(watchers.isKubernetesInternalNamespace('node-lease'),
    'kubenode-lease is not a k8s internal namespace');
  t.notOk(watchers.isKubernetesInternalNamespace('snyk-monitor'),
    'snyk-monitor is not a k8s internal namespace');
  t.notOk(watchers.isKubernetesInternalNamespace('egg'),
    'egg is not a k8s internal namespace');
  t.notOk(watchers.isKubernetesInternalNamespace(''),
    'empty string is not a k8s internal namespace');
  t.notOk(watchers.isKubernetesInternalNamespace(undefined as unknown as string),
    'undefined is not a k8s internal namespace');
});
