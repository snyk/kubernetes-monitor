import { makeInformer, ADD } from '@kubernetes/client-node';
import { V1Namespace } from '@kubernetes/client-node';
import config = require('../../common/config');
import logger = require('../../common/logger');
import { WorkloadKind } from '../types';
import { setupInformer } from './handlers';
import { kubeConfig, k8sApi } from '../cluster';

function setupWatchesForNamespace(namespace: string) {
  logger.info({namespace}, 'Setting up namespace watch');

  for (const workloadKind of Object.values(WorkloadKind)) {
    try {
      setupInformer(namespace, workloadKind);
    } catch (error) {
      logger.warn({namespace, workloadKind}, 'could not setup workload watch, skipping');
    }
  }
}

function setupWatchesForCluster() {
  const informer = makeInformer(kubeConfig, '/api/v1/namespaces', () => k8sApi.coreClient.listNamespace());

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

export function beginWatchingWorkloads() {
  if (config.NAMESPACE) {
    logger.info({namespace: config.NAMESPACE}, 'kubernetes-monitor restricted to specific namespace');
    setupWatchesForNamespace(config.NAMESPACE);
    return;
  }

  setupWatchesForCluster();
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
  ];

  return kubernetesInternalNamespaces.includes(namespace);
}
