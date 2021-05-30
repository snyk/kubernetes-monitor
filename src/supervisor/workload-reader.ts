import { V1OwnerReference } from '@kubernetes/client-node';

import * as kubernetesApiWrappers from './kuberenetes-api-wrappers';
import { k8sApi } from './cluster';
import { IKubeObjectMetadata, WorkloadKind } from './types';
import { logger } from '../common/logger';
import { V1DeploymentConfig } from './watchers/handlers/types';

type IKubeObjectMetadataWithoutPodSpec = Omit<IKubeObjectMetadata, 'podSpec'>;
type IWorkloadReaderFunc = (
  workloadName: string,
  namespace: string,
) => Promise<IKubeObjectMetadataWithoutPodSpec | undefined>;

const deploymentReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const deploymentResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.appsClient.readNamespacedDeployment(workloadName, namespace),
    );
  const deployment = deploymentResult.body;

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
  return metadata;
};

/** https://docs.openshift.com/container-platform/4.7/rest_api/workloads_apis/deploymentconfig-apps-openshift-io-v1.html */
const deploymentConfigReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
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
  const deployment: V1DeploymentConfig = deploymentResult.body;

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
  return metadata;
};

const replicaSetReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const replicaSetResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.appsClient.readNamespacedReplicaSet(workloadName, namespace),
    );
  const replicaSet = replicaSetResult.body;

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
  return metadata;
};

const statefulSetReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const statefulSetResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.appsClient.readNamespacedStatefulSet(workloadName, namespace),
    );
  const statefulSet = statefulSetResult.body;

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
  return metadata;
};

const daemonSetReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const daemonSetResult = await kubernetesApiWrappers.retryKubernetesApiRequest(
    () => k8sApi.appsClient.readNamespacedDaemonSet(workloadName, namespace),
  );
  const daemonSet = daemonSetResult.body;

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
  return metadata;
};

const jobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const jobResult = await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
    k8sApi.batchClient.readNamespacedJob(workloadName, namespace),
  );
  const job = jobResult.body;

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
  return metadata;
};

// Keep an eye on this! We need v1beta1 API for CronJobs.
// https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
// CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
const cronJobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const cronJobResult = await kubernetesApiWrappers.retryKubernetesApiRequest(
    () =>
      k8sApi.batchUnstableClient.readNamespacedCronJob(workloadName, namespace),
  );
  const cronJob = cronJobResult.body;

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
  return metadata;
};

const replicationControllerReader: IWorkloadReaderFunc = async (
  workloadName,
  namespace,
) => {
  const replicationControllerResult =
    await kubernetesApiWrappers.retryKubernetesApiRequest(() =>
      k8sApi.coreClient.readNamespacedReplicationController(
        workloadName,
        namespace,
      ),
    );
  const replicationController = replicationControllerResult.body;

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
const workloadReader = {
  [WorkloadKind.Deployment]: deploymentReader,
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
