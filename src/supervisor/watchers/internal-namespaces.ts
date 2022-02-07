import { V1Namespace } from '@kubernetes/client-node';
import { config } from '../../common/config';

export const kubernetesInternalNamespaces = new Set([
  'kube-node-lease',
  'kube-public',
  'kube-system',
  'local-path-storage',
]);

export const openshiftInternalNamespaces = new Set([
  'openshift',
  'openshift-apiserver',
  'openshift-apiserver-operator',
  'openshift-aqua',
  'openshift-authentication',
  'openshift-authentication-operator',
  'openshift-backplane',
  'openshift-backplane-cee',
  'openshift-backplane-srep',
  'openshift-build-test',
  'openshift-cloud-credential-operator',
  'openshift-cloud-ingress-operator',
  'openshift-cluster-csi-drivers',
  'openshift-cluster-machine-approver',
  'openshift-cluster-node-tuning-operator',
  'openshift-cluster-samples-operator',
  'openshift-cluster-storage-operator',
  'openshift-cluster-version',
  'openshift-codeready-workspaces',
  'openshift-config',
  'openshift-config-managed',
  'openshift-config-operator',
  'openshift-console',
  'openshift-console-operator',
  'openshift-console-user-settings',
  'openshift-controller-manager',
  'openshift-controller-manager-operator',
  'openshift-custom-domains-operator',
  'openshift-customer-monitoring',
  'openshift-dns',
  'openshift-dns-operator',
  'openshift-etcd',
  'openshift-etcd-operator',
  'openshift-image-registry',
  'openshift-infra',
  'openshift-ingress',
  'openshift-ingress-canary',
  'openshift-ingress-operator',
  'openshift-insights',
  'openshift-kni-infra',
  'openshift-kube-apiserver',
  'openshift-kube-apiserver-operator',
  'openshift-kube-controller-manager',
  'openshift-kube-controller-manager-operator',
  'openshift-kube-scheduler',
  'openshift-kube-scheduler-operator',
  'openshift-kube-storage-version-migrator',
  'openshift-kube-storage-version-migrator-operator',
  'openshift-kubevirt-infra',
  'openshift-logging',
  'openshift-machine-api',
  'openshift-machine-config-operator',
  'openshift-managed-upgrade-operator',
  'openshift-marketplace',
  'openshift-monitoring',
  'openshift-multus',
  'openshift-must-gather-operator',
  'openshift-network-diagnostics',
  'openshift-network-operator',
  'openshift-node',
  'openshift-oauth-apiserver',
  'openshift-openstack-infra',
  'openshift-operator-lifecycle-manager',
  'openshift-operators',
  'openshift-operators-redhat',
  'openshift-osd-metrics',
  'openshift-ovirt-infra',
  'openshift-rbac-permissions',
  'openshift-route-monitor-operator',
  'openshift-sdn',
  'openshift-security',
  'openshift-service-ca',
  'openshift-service-ca-operator',
  'openshift-service-catalog-apiserver-operator',
  'openshift-service-catalog-controller-manager-operator',
  'openshift-service-catalog-removed',
  'openshift-splunk-forwarder-operator',
  'openshift-sre-pruning',
  'openshift-sre-sshd',
  'openshift-strimzi',
  'openshift-user-workload-monitoring',
  'openshift-validation-webhook',
  'openshift-velero',
  'openshift-vsphere-infra',
]);

export function extractNamespaceName(namespace: V1Namespace): string {
  if (namespace && namespace.metadata && namespace.metadata.name) {
    return namespace.metadata.name;
  }
  throw new Error('Namespace missing metadata.name');
}

export function isExcludedNamespace(namespace: string): boolean {
  return (
    (config.EXCLUDED_NAMESPACES
      ? config.EXCLUDED_NAMESPACES.includes(namespace)
      : kubernetesInternalNamespaces.has(namespace)) ||
    // always check openshift excluded namespaces
    openshiftInternalNamespaces.has(namespace)
  );
}
