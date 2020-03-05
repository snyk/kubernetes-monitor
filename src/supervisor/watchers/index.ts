import { makeInformer, ADD } from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';

import config = require('../../common/config');
import logger = require('../../common/logger');
import { WorkloadKind } from '../types';
import { setupInformer } from './handlers';
import { kubeConfig, k8sApi } from '../cluster';

/**
 * This map keeps track of all currently watched namespaces.
 * Prevents duplicate watches being created if the same namespace is deleted
 * and then re-created. Once a watch is set up once, it doesn't have to be
 * tracked anymore as the kubernetes-client Informer API handles this internally.
 */
const watchedNamespaces = new Set<string>();

function setupWatchesForNamespace(namespace: string): void {
  if (watchedNamespaces.has(namespace)) {
    logger.info({namespace}, 'already set up namespace watch, skipping');
    return;
  }

  logger.info({namespace}, 'setting up namespace watch');

  for (const workloadKind of Object.values(WorkloadKind)) {
    try {
      setupInformer(namespace, workloadKind);
    } catch (error) {
      logger.warn({namespace, workloadKind}, 'could not setup workload watch, skipping');
    }
  }

  watchedNamespaces.add(namespace);
}

export function extractNamespaceName(namespace: V1Namespace): string {
  if (namespace && namespace.metadata && namespace.metadata.name) {
    return namespace.metadata.name;
  }
  throw new Error('Namespace missing metadata.name');
}

export function isKubernetesInternalNamespace(namespace: string): boolean {
  const kubernetesInternalNamespaces = [
    'kube-node-lease',
    'kube-public',
    'kube-system',
    'openshift-apiserver',
    'openshift-apiserver-operator',
    'openshift-authentication',
    'openshift-authentication-operator',
    'openshift-cloud-credential-operator',
    'openshift-cluster-machine-approver',
    'openshift-cluster-node-tuning-operator',
    'openshift-cluster-samples-operator',
    'openshift-cluster-storage-operator',
    'openshift-cluster-version',
    'openshift-config',
    'openshift-config-managed',
    'openshift-console',
    'openshift-console-operator',
    'openshift-controller-manager',
    'openshift-controller-manager-operator',
    'openshift-dns',
    'openshift-dns-operator',
    'openshift-etcd',
    'openshift-image-registry',
    'openshift-infra',
    'openshift-ingress',
    'openshift-ingress-operator',
    'openshift-insights',
    'openshift-kni-infra',
    'openshift-kube-apiserver',
    'openshift-kube-apiserver-operator',
    'openshift-kube-controller-manager',
    'openshift-kube-controller-manager-operator',
    'openshift-kube-scheduler',
    'openshift-kube-scheduler-operator',
    'openshift-machine-api',
    'openshift-machine-config-operator',
    'openshift-marketplace',
    'openshift-monitoring',
    'openshift-multus',
    'openshift-network-operator',
    'openshift-node',
    'openshift-openstack-infra',
    'openshift-operator-lifecycle-manager',
    'openshift-operators',
    'openshift-ovirt-infra',
    'openshift-sdn',
    'openshift-service-ca',
    'openshift-service-ca-operator',
    'openshift-service-catalog-apiserver-operator',
    'openshift-service-catalog-controller-manager-operator',
    'openshift-user-workload-monitoring',
  ];

  return kubernetesInternalNamespaces.includes(namespace);
}

function setupWatchesForCluster(): void {
  const informer = makeInformer(
    kubeConfig,
    '/api/v1/namespaces',
    async () => {
      try {
        return await k8sApi.coreClient.listNamespace();
      } catch (err) {
        logger.error({err}, 'error while listing namespaces');
        throw err;
      }
    },
  );

  informer.on(ADD, (namespace: V1Namespace) => {
    try {
      const namespaceName = extractNamespaceName(namespace);
      if (isKubernetesInternalNamespace(namespaceName)) {
        // disregard namespaces internal to kubernetes
        logger.info({namespaceName}, 'ignoring blacklisted namespace');
        return;
      }

      setupWatchesForNamespace(namespaceName);
    } catch (err) {
      logger.error({err, namespace}, 'error handling a namespace event');
      return;
    }
  });

  informer.start();
}

export function beginWatchingWorkloads(): void {
  if (config.NAMESPACE) {
    logger.info({namespace: config.NAMESPACE}, 'kubernetes-monitor restricted to specific namespace');
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  setupWatchesForCluster();
}

