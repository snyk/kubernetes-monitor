import { V1OwnerReference } from '@kubernetes/client-node';

import * as kubernetesApiWrappers from './kuberenetes-api-wrappers';
import { k8sApi } from './cluster';
import { IKubeObjectMetadataWithoutPodSpec, WorkloadKind } from './types';
import { logger } from '../common/logger';
import { V1alpha1Rollout, V1DeploymentConfig } from './watchers/handlers/types';
import { trimWorkload } from './workload-sanitization';
import { getCachedWorkloadMetadata, setCachedWorkloadMetadata } from '../state';

type IWorkloadReaderFunc = (
  workloadName: string,
  namespace: string,
) => Promise<IKubeObjectMetadataWithoutPodSpec | undefined>;

const deploymentReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const deploymentResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.appsClient.readNamespacedDeployment({
        name: workloadName,
        namespace,
      }),
    );
  const deployment = trimWorkload(deploymentResult);

  if (
    !deployment.metadata ||
    !deployment.spec ||
    !deployment.spec.template.metadata ||
    !deployment.spec.template.spec ||
    !deployment.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.Deployment,
    objectMeta: deployment.metadata,
    specMeta: deployment.spec.template.metadata,
    ownerRefs: deployment.metadata.ownerReferences,
    revision: deployment.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

/** https://docs.openshift.com/container-platform/4.7/rest_api/workloads_apis/deploymentconfig-apps-openshift-io-v1.html */
const deploymentConfigReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const deploymentResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.customObjectsClient.getNamespacedCustomObject({
        group: 'apps.openshift.io',
        version: 'v1',
        namespace,
        plural: 'deploymentconfigs',
        name: workloadName,
      }),
    );
  const deployment: V1DeploymentConfig = trimWorkload(deploymentResult.body);

  if (
    !deployment.metadata ||
    !deployment.spec ||
    !deployment.spec.template.metadata ||
    !deployment.spec.template.spec ||
    !deployment.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.DeploymentConfig,
    objectMeta: deployment.metadata,
    specMeta: deployment.spec.template.metadata,
    ownerRefs: deployment.metadata.ownerReferences,
    revision: deployment.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const replicaSetReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const replicaSetResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.appsClient.readNamespacedReplicaSet({
        name: workloadName,
        namespace,
      }),
    );
  const replicaSet = trimWorkload(replicaSetResult);

  if (
    !replicaSet.metadata ||
    !replicaSet.spec ||
    !replicaSet.spec.template ||
    !replicaSet.spec.template.metadata ||
    !replicaSet.spec.template.spec ||
    !replicaSet.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.ReplicaSet,
    objectMeta: replicaSet.metadata,
    specMeta: replicaSet.spec.template.metadata,
    ownerRefs: replicaSet.metadata.ownerReferences,
    revision: replicaSet.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const statefulSetReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const statefulSetResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.appsClient.readNamespacedStatefulSet({
        name: workloadName,
        namespace,
      }),
    );
  const statefulSet = trimWorkload(statefulSetResult);

  if (
    !statefulSet.metadata ||
    !statefulSet.spec ||
    !statefulSet.spec.template.metadata ||
    !statefulSet.spec.template.spec ||
    !statefulSet.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.StatefulSet,
    objectMeta: statefulSet.metadata,
    specMeta: statefulSet.spec.template.metadata,
    ownerRefs: statefulSet.metadata.ownerReferences,
    revision: statefulSet.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const daemonSetReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const daemonSetResult = await kubernetesApiWrappers.retryKubernetesApiRequest(
    () =>
      k8sApi.appsClient.readNamespacedDaemonSet({
        name: workloadName,
        namespace,
      }),
  );
  const daemonSet = trimWorkload(daemonSetResult);

  if (
    !daemonSet.metadata ||
    !daemonSet.spec ||
    !daemonSet.spec.template.spec ||
    !daemonSet.spec.template.metadata ||
    !daemonSet.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.DaemonSet,
    objectMeta: daemonSet.metadata,
    specMeta: daemonSet.spec.template.metadata,
    ownerRefs: daemonSet.metadata.ownerReferences,
    revision: daemonSet.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const jobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const jobResult = await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
    k8sApi.batchClient.readNamespacedJob({ name: workloadName, namespace }),
  );
  const job = trimWorkload(jobResult);

  if (
    !job.metadata ||
    !job.spec ||
    !job.spec.template.spec ||
    !job.spec.template.metadata
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.Job,
    objectMeta: job.metadata,
    specMeta: job.spec.template.metadata,
    ownerRefs: job.metadata.ownerReferences,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const cronJobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const cronJobResult = await kubernetesApiWrappers.retryKubernetesApiRequest(
    () =>
      k8sApi.batchClient.readNamespacedCronJob({
        name: workloadName,
        namespace,
      }),
  );
  const cronJob = trimWorkload(cronJobResult);

  if (
    !cronJob.metadata ||
    !cronJob.spec ||
    !cronJob.spec.jobTemplate.metadata ||
    !cronJob.spec.jobTemplate.spec ||
    !cronJob.spec.jobTemplate.spec.template.spec
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.CronJob,
    objectMeta: cronJob.metadata,
    specMeta: cronJob.spec.jobTemplate.metadata,
    ownerRefs: cronJob.metadata.ownerReferences,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const replicationControllerReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const replicationControllerResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.coreClient.readNamespacedReplicationController({
        name: workloadName,
        namespace,
      }),
    );
  const replicationController = trimWorkload(replicationControllerResult);

  if (
    !replicationController.metadata ||
    !replicationController.spec ||
    !replicationController.spec.template ||
    !replicationController.spec.template.metadata ||
    !replicationController.spec.template.spec ||
    !replicationController.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.ReplicationController,
    objectMeta: replicationController.metadata,
    specMeta: replicationController.spec.template.metadata,
    ownerRefs: replicationController.metadata.ownerReferences,
    revision: replicationController.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

const argoRolloutReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const rolloutResult = await kubernetesApiWrappers.retryKubernetesApiRequest(
    () =>
      k8sApi.customObjectsClient.getNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace,
        plural: 'rollouts',
        name: workloadName,
      }),
  );
  const rollout: V1alpha1Rollout = trimWorkload(rolloutResult.body);

  if (rollout.spec?.workloadRef && rollout.metadata?.namespace) {
    // Lookup child template metadata when a workloadRef is defined
    const workloadReader = getWorkloadReader(rollout.spec.workloadRef.kind);
    const workloadMetadata = await workloadReader(
      rollout.spec.workloadRef.name,
      rollout.metadata.namespace,
    );
    rollout.spec.template = {
      metadata: workloadMetadata?.specMeta,
    };
  }

  if (
    !rollout.metadata ||
    !rollout.spec?.template?.metadata ||
    !rollout.status
  ) {
    logIncompleteWorkload(workloadName, namespace);

    return undefined;
  }

  const metadata: IKubeObjectMetadataWithoutPodSpec = {
    kind: WorkloadKind.ArgoRollout,
    objectMeta: rollout.metadata,
    specMeta: rollout.spec.template.metadata,
    ownerRefs: rollout.metadata.ownerReferences,
    revision: rollout.status.observedGeneration,
  };
  setCachedWorkloadMetadata(workloadName, namespace, metadata);
  return metadata;
};

function logIncompleteWorkload(workloadName: string, namespace: string): void {
  logger.info(
    { workloadName, namespace },
    'kubernetes api could not return workload',
  );
}

// Here we are using the "kind" property of a k8s object as a key to map it to a reader.
// This gives us a quick look up table where we can abstract away the internal implementation of reading a resource
// and just grab a generic handler/reader that does that for us (based on the "kind").
const workloadReader: Record<string, IWorkloadReaderFunc> = {
  [WorkloadKind.Deployment]: deploymentReader,
  [WorkloadKind.ArgoRollout]: argoRolloutReader,
  [WorkloadKind.ReplicaSet]: replicaSetReader,
  [WorkloadKind.StatefulSet]: statefulSetReader,
  [WorkloadKind.DaemonSet]: daemonSetReader,
  [WorkloadKind.Job]: jobReader,
  [WorkloadKind.CronJob]: cronJobReader,
  [WorkloadKind.ReplicationController]: replicationControllerReader,
  [WorkloadKind.DeploymentConfig]: deploymentConfigReader,
};

export const SupportedWorkloadTypes = Object.keys(workloadReader);

export function getWorkloadReader(workloadType: string): IWorkloadReaderFunc {
  return workloadReader[workloadType];
}

export function getSupportedWorkload(
  ownerRefs: V1OwnerReference[] | undefined,
): V1OwnerReference | undefined {
  return ownerRefs !== undefined
    ? ownerRefs.find((owner) => SupportedWorkloadTypes.includes(owner.kind))
    : undefined;
}
