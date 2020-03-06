import * as tap from 'tap';
import { V1Namespace } from '@kubernetes/client-node';

import watchers = require('../../../src/supervisor/watchers');

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
  t.ok(watchers.isKubernetesInternalNamespace('openshift-apiserver'),
    'openshift-apiserver is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-apiserver-operator'),
    'openshift-apiserver-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-authentication'),
    'openshift-authentication is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-authentication-operator'),
    'openshift-authentication-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-cloud-credential-operator'),
    'openshift-cloud-credential-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-cluster-machine-approver'),
    'openshift-cluster-machine-approver is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-cluster-node-tuning-operator'),
    'openshift-cluster-node-tuning-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-cluster-samples-operator'),
    'openshift-cluster-samples-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-cluster-storage-operator'),
    'openshift-cluster-storage-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-cluster-version'),
    'openshift-cluster-version is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-config'),
    'openshift-config is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-config-managed'),
    'openshift-config-managed is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-console'),
    'openshift-console is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-console-operator'),
    'openshift-console-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-controller-manager'),
    'openshift-controller-manager is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-controller-manager-operator'),
    'openshift-controller-manager-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-dns'),
    'openshift-dns is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-dns-operator'),
    'openshift-dns-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-etcd'),
    'openshift-etcd is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-image-registry'),
    'openshift-image-registry is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-infra'),
    'openshift-infra is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-ingress'),
    'openshift-ingress is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-ingress-operator'),
    'openshift-ingress-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-insights'),
    'openshift-insights is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kni-infra'),
    'openshift-kni-infra is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kube-apiserver'),
    'openshift-kube-apiserver is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kube-apiserver-operator'),
    'openshift-kube-apiserver-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kube-controller-manager'),
    'openshift-kube-controller-manager is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kube-controller-manager-operator'),
    'openshift-kube-controller-manager-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kube-scheduler'),
    'openshift-kube-scheduler is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-kube-scheduler-operator'),
    'openshift-kube-scheduler-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-machine-api'),
    'openshift-machine-api is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-machine-config-operator'),
    'openshift-machine-config-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-marketplace'),
    'openshift-marketplace is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-monitoring'),
    'openshift-monitoring is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-multus'),
    'openshift-multus is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-network-operator'),
    'openshift-network-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-node'),
    'openshift-node is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-openstack-infra'),
    'openshift-openstack-infra is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-operator-lifecycle-manager'),
    'openshift-operator-lifecycle-manager is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-operators'),
    'openshift-operators is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-ovirt-infra'),
    'openshift-ovirt-infra is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-sdn'),
    'openshift-sdn is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-service-ca'),
    'openshift-service-ca is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-service-ca-operator'),
    'openshift-service-ca-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-service-catalog-apiserver-operator'),
    'openshift-service-catalog-apiserver-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-service-catalog-controller-manager-operator'),
    'openshift-service-catalog-controller-manager-operator is a k8s internal namespace');
  t.ok(watchers.isKubernetesInternalNamespace('openshift-user-workload-monitoring'),
    'openshift-user-workload-monitoring is a k8s internal namespace');
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
