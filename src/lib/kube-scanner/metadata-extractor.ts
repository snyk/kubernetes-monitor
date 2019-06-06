import { V1Container, V1ObjectMeta, V1OwnerReference, V1Pod } from '@kubernetes/client-node';
import { isEmpty, keys } from 'lodash';
import { IKubeImage } from '../../transmitter/types';
import { currentClusterName, k8sApi } from './cluster';

type IWorkloadHandlerFunc = (
  podOwner: V1OwnerReference | undefined,
  pod: V1Pod,
) => Promise<IKubeImage[]>;

// Constructs the workload metadata based on a variety of k8s properties.
// https://www.notion.so/snyk/Kubernetes-workload-fields-we-should-collect-c60c8f0395f241978282173f4c133a34
function buildImageMetadata(
    kind: string,
    objectMeta: V1ObjectMeta,
    specMeta: V1ObjectMeta,
    containers: V1Container[],
): IKubeImage[] {
  const { name, namespace, labels, annotations, uid } = objectMeta;
  const images = containers.map(({ name: containerName, image }) => ({
      kind,
      name,
      namespace,
      labels,
      annotations,
      uid,
      specLabels: specMeta.labels,
      specAnnotations: specMeta.annotations,
      containerName,
      imageName: image,
      cluster: currentClusterName,
    } as IKubeImage),
  );
  return images;
}

const DeploymentHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const deploymentResult = await k8sApi.appsClient.readNamespacedDeployment(
    podOwner.name, pod.metadata.namespace);
  const deployment = deploymentResult.body;

  return buildImageMetadata(deployment.kind,
    deployment.metadata,
    deployment.spec.template.metadata,
    deployment.spec.template.spec.containers);
};

const ReplicaSetHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const replicaSetResult = await k8sApi.appsClient.readNamespacedReplicaSet(
    podOwner.name, pod.metadata.namespace);
  const replicaSet = replicaSetResult.body;

  return buildImageMetadata(replicaSet.kind,
    replicaSet.metadata,
    replicaSet.spec.template.metadata,
    replicaSet.spec.template.spec.containers);
};

const StatefulSetHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const statefulSetResult = await k8sApi.appsClient.readNamespacedStatefulSet(
    podOwner.name, pod.metadata.namespace);
  const statefulSet = statefulSetResult.body;

  return buildImageMetadata(statefulSet.kind,
    statefulSet.metadata,
    statefulSet.spec.template.metadata,
    statefulSet.spec.template.spec.containers);
};

const DaemonSetHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const daemonSetResult = await k8sApi.appsClient.readNamespacedDaemonSet(
    podOwner.name, pod.metadata.namespace);
  const daemonSet = daemonSetResult.body;

  return buildImageMetadata(daemonSet.kind,
    daemonSet.metadata,
    daemonSet.spec.template.metadata,
    daemonSet.spec.template.spec.containers);
};

const JobHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const jobResult = await k8sApi.batchClient.readNamespacedJob(
    podOwner.name, pod.metadata.namespace);
  const job = jobResult.body;

  return buildImageMetadata(job.kind,
    job.metadata,
    job.spec.template.metadata,
    job.spec.template.spec.containers);
};

// Keep an eye on this! We need v1beta1 API for CronJobs.
// https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
// CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
const CronJobHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const cronJobResult = await k8sApi.batchUnstableClient.readNamespacedCronJob(
    podOwner.name, pod.metadata.namespace);
  const cronJob = cronJobResult.body;

  return buildImageMetadata(cronJob.kind,
    cronJob.metadata,
    // Notice: unlike the other references, here we use `jobTemplate` and not `template`.
    cronJob.spec.jobTemplate.metadata,
    cronJob.spec.jobTemplate.spec.template.spec.containers);
};

const ReplicationControllerHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner === undefined) {
    throw Error(`Expected to find a parent/owner of the pod ${pod.metadata.name}`);
  }

  const replicationControllerResult = await k8sApi.coreClient.readNamespacedReplicationController(
    podOwner.name, pod.metadata.namespace);
  const replicationController = replicationControllerResult.body;

  return buildImageMetadata(replicationController.kind,
    replicationController.metadata,
    replicationController.spec.template.metadata,
    replicationController.spec.template.spec.containers);
};

const PodHandler: IWorkloadHandlerFunc = async (podOwner, pod) => {
  if (podOwner !== undefined || podOwner !== null) {
    throw Error(`The pod must not have any parent/owner`);
  }

  return buildImageMetadata(DefaultWorkloadType,
    pod.metadata,
    pod.metadata, // Pods are a bit special in that they lack `spec.template.metadata`
    pod.spec.containers);
};

const WorkloadHandler = {
  Deployment: DeploymentHandler,
  ReplicaSet: ReplicaSetHandler,
  StatefulSet: StatefulSetHandler,
  DaemonSet: DaemonSetHandler,
  Job: JobHandler,
  CronJob: CronJobHandler,
  ReplicationController: ReplicationControllerHandler,
  Pod: PodHandler,
};

const { Pod, ...SupportedWorkloads } = WorkloadHandler;

const SupportedWorkloadTypes = keys(SupportedWorkloads);
const DefaultWorkloadType = 'Pod';

export function buildMetadataForWorkload(pod: V1Pod): Promise<IKubeImage[] | undefined> {
  // Determine the workload type -- some workloads carry extra metadata info.
  // We are also interested only in a small subset of all workloads.
  const podOwner = pod.metadata.ownerReferences
    .find((owner) => SupportedWorkloadTypes.includes(owner.kind));
  const isAssociatedWithParent = pod.metadata.ownerReferences
    .some((owner) => !isEmpty(owner.kind));

  if (podOwner === undefined && isAssociatedWithParent) {
    // Unsupported workload, we don't want to track it.
    return Promise.resolve(undefined);
  }

  const workloadType = (podOwner === undefined && !isAssociatedWithParent)
    ? DefaultWorkloadType
    : podOwner!.kind;

  const handler: IWorkloadHandlerFunc = WorkloadHandler[workloadType];
  return handler(podOwner, pod);
}
