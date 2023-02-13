import { V1OwnerReference } from '@kubernetes/client-node';

import * as kubernetesApiWrappers from './kuberenetes-api-wrappers';
import { k8sApi } from './cluster';
import { IKubeObjectMetadata, WorkloadKind } from './types';
import { logger } from '../common/logger';
import { V1alpha1Rollout, V1DeploymentConfig } from './watchers/handlers/types';
import { trimWorkload } from './workload-sanitization';
import { getCachedWorkloadMetadata, setCachedWorkloadMetadata } from '../state';

type IKubeObjectMetadataWithoutPodSpec = Omit<IKubeObjectMetadata, 'podSpec'>;
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
      k8sApi.appsClient.readNamespacedDeployment(workloadName, namespace),
    );
  const deployment = trimWorkload(deploymentResult.body);

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
      k8sApi.customObjectsClient.getNamespacedCustomObject(
        'apps.openshift.io',
        'v1',
        namespace,
        'deploymentconfigs',
        workloadName,
      ),
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
      k8sApi.appsClient.readNamespacedReplicaSet(workloadName, namespace),
    );
  const replicaSet = trimWorkload(replicaSetResult.body);

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
      k8sApi.appsClient.readNamespacedStatefulSet(workloadName, namespace),
    );
  const statefulSet = trimWorkload(statefulSetResult.body);

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
    () => k8sApi.appsClient.readNamespacedDaemonSet(workloadName, namespace),
  );
  const daemonSet = trimWorkload(daemonSetResult.body);

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
    k8sApi.batchClient.readNamespacedJob(workloadName, namespace),
  );
  const job = trimWorkload(jobResult.body);

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

// cronJobReader can read v1 and v1beta1 CronJobs
const cronJobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const cachedMetadata = getCachedWorkloadMetadata(workloadName, namespace);
  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  const cronJobResult = await kubernetesApiWrappers
    .retryKubernetesApiRequest(() =>
      k8sApi.batchClient.readNamespacedCronJob(workloadName, namespace),
    )
    // In case the V1 client fails, try using the V1Beta1 client.
    .catch(() =>
      kubernetesApiWrappers.retryKubernetesApiRequest(() =>
        k8sApi.batchUnstableClient.readNamespacedCronJob(
          workloadName,
          namespace,
        ),
      ),
    );
  const cronJob = trimWorkload(cronJobResult.body);

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
      k8sApi.coreClient.readNamespacedReplicationController(
        workloadName,
        namespace,
      ),
    );
  const replicationController = trimWorkload(replicationControllerResult.body);

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
      k8sApi.customObjectsClient.getNamespacedCustomObject(
        'argoproj.io',
        'v1alpha1',
        namespace,
        'rollouts',
        workloadName,
      ),
  );
  const rollout: V1alpha1Rollout = trimWorkload(rolloutResult.body);

  if (
    !rollout.metadata ||
    !rollout.spec ||
    !rollout.spec.template.metadata ||
    !rollout.spec.template.spec ||
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
  // ------------
  // Note: WorkloadKind.CronJobV1Beta1 is intentionally not listed here.
  // The WorkloadKind.CronJob reader can handle both v1 and v1beta1 API versions.
  // ------------
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
