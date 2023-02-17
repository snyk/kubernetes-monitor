import { makeInformer, ERROR, KubernetesObject } from '@kubernetes/client-node';

import { logger } from '../../../common/logger';
import { WorkloadKind } from '../../types';
import * as cronJob from './cron-job';
import * as deploymentConfig from './deployment-config';
import * as rollout from './argo-rollout';
import { k8sApi, kubeConfig } from '../../cluster';
import * as kubernetesApiWrappers from '../../kuberenetes-api-wrappers';
import { FALSY_WORKLOAD_NAME_MARKER, KubernetesInformerVerb } from './types';
import { RETRYABLE_NETWORK_ERRORS } from '../types';
import { workloadWatchMetadata } from './informer-config';
import { isExcludedNamespace } from '../internal-namespaces';

async function isSupportedNamespacedWorkload(
  namespace: string,
  workloadKind: WorkloadKind,
): Promise<boolean> {
  switch (workloadKind) {
    case WorkloadKind.ArgoRollout:
      return await rollout.isNamespacedArgoRolloutSupported(namespace);
    case WorkloadKind.DeploymentConfig:
      return await deploymentConfig.isNamespacedDeploymentConfigSupported(
        namespace,
      );
    case WorkloadKind.CronJobV1Beta1:
      return await cronJob.isNamespacedCronJobSupported(
        workloadKind,
        namespace,
        k8sApi.batchUnstableClient,
      );
    case WorkloadKind.CronJob:
      return await cronJob.isNamespacedCronJobSupported(
        workloadKind,
        namespace,
        k8sApi.batchClient,
      );
    default:
      return true;
  }
}

async function isSupportedClusterWorkload(
  workloadKind: WorkloadKind,
): Promise<boolean> {
  switch (workloadKind) {
    case WorkloadKind.DeploymentConfig:
      return await deploymentConfig.isClusterDeploymentConfigSupported();
    case WorkloadKind.ArgoRollout:
      return await rollout.isClusterArgoRolloutSupported();
    case WorkloadKind.CronJobV1Beta1:
      return await cronJob.isClusterCronJobSupported(
        workloadKind,
        k8sApi.batchUnstableClient,
      );
    case WorkloadKind.CronJob:
      return await cronJob.isClusterCronJobSupported(
        workloadKind,
        k8sApi.batchClient,
      );
    default:
      return true;
  }
}

export async function setupNamespacedInformer(
  namespace: string,
  workloadKind: WorkloadKind,
): Promise<void> {
  const logContext: Record<string, unknown> = { namespace, workloadKind };
  const isSupported = await isSupportedNamespacedWorkload(
    namespace,
    workloadKind,
  );
  if (!isSupported) {
    logger.debug(
      logContext,
      'The Kubernetes cluster does not support this workload',
    );
    return;
  }

  const workloadMetadata = workloadWatchMetadata[workloadKind];
  if (!workloadMetadata) {
    logger.debug(logContext, 'Workload kind is not monitored');
    return;
  }
  const endpoint = workloadMetadata.namespacedEndpoint.replace(
    '{namespace}',
    namespace,
  );

  const listMethod = workloadMetadata.namespacedListFactory(namespace);
  const loggedListMethod = async () => {
    try {
      return await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        listMethod(),
      );
    } catch (error) {
      logger.error(
        { ...logContext, error },
        'error while listing workloads in namespace',
      );
      throw error;
    }
  };

  const informer = makeInformer<KubernetesObject>(
    kubeConfig,
    endpoint,
    loggedListMethod,
  );

  informer.on(ERROR, (error) => {
    const code = error.code || '';
    logContext.code = code;
    if (RETRYABLE_NETWORK_ERRORS.includes(code)) {
      logger.debug(logContext, 'informer error occurred, restarting informer');

      // Restart informer after 1sec
      setTimeout(async () => {
        await informer.start();
      }, 1000);
    } else {
      logger.error(
        { ...logContext, error },
        'unexpected informer error event occurred',
      );
    }
  });

  for (const informerVerb of Object.keys(workloadMetadata.handlers)) {
    informer.on(
      informerVerb as KubernetesInformerVerb,
      async (watchedWorkload) => {
        try {
          await workloadMetadata.handlers[informerVerb](watchedWorkload);
        } catch (error) {
          const name =
            (watchedWorkload.metadata && watchedWorkload.metadata.name) ||
            FALSY_WORKLOAD_NAME_MARKER;
          logger.warn(
            { ...logContext, error, workloadName: name },
            'could not execute the namespaced informer handler for a workload',
          );
        }
      },
    );
  }

  await informer.start();
}

export async function setupClusterInformer(
  workloadKind: WorkloadKind,
): Promise<void> {
  const logContext: Record<string, unknown> = { workloadKind };
  const isSupported = await isSupportedClusterWorkload(workloadKind);
  if (!isSupported) {
    logger.debug(
      logContext,
      'The Kubernetes cluster does not support this workload',
    );
    return;
  }

  const workloadMetadata = workloadWatchMetadata[workloadKind];
  if (!workloadMetadata) {
    logger.debug(logContext, 'Workload kind is not monitored');
    return;
  }
  const endpoint = workloadMetadata.clusterEndpoint;

  const listMethod = workloadMetadata.clusterListFactory();
  const loggedListMethod = async () => {
    try {
      return await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        listMethod(),
      );
    } catch (error) {
      logger.error(
        { ...logContext, error },
        'error while listing workloads in cluster',
      );
      throw error;
    }
  };

  const informer = makeInformer<KubernetesObject>(
    kubeConfig,
    endpoint,
    loggedListMethod,
  );

  informer.on(ERROR, (error) => {
    const code = error.code || '';
    logContext.code = code;
    if (RETRYABLE_NETWORK_ERRORS.includes(code)) {
      logger.debug(logContext, 'informer error occurred, restarting informer');

      // Restart informer after 1sec
      setTimeout(async () => {
        await informer.start();
      }, 1000);
    } else {
      logger.error(
        { ...logContext, error },
        'unexpected informer error event occurred',
      );
    }
  });

  for (const informerVerb of Object.keys(workloadMetadata.handlers)) {
    informer.on(
      informerVerb as KubernetesInformerVerb,
      async (watchedWorkload) => {
        try {
          if (isExcludedNamespace(watchedWorkload.metadata?.namespace || '')) {
            return;
          }

          await workloadMetadata.handlers[informerVerb](watchedWorkload);
        } catch (error) {
          const name =
            (watchedWorkload.metadata && watchedWorkload.metadata.name) ||
            FALSY_WORKLOAD_NAME_MARKER;
          logger.warn(
            { ...logContext, error, workloadName: name },
            'could not execute the cluster informer handler for a workload',
          );
        }
      },
    );
  }

  await informer.start();
}
