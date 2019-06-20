import { V1OwnerReference } from '@kubernetes/client-node';
import { keys } from 'lodash';
import { k8sApi } from './cluster';
import { KubeObjectMetadata } from './types';

type IWorkloadReaderFunc = (
  workloadName: string,
  namespace: string,
) => Promise<KubeObjectMetadata>;

const deploymentReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const deploymentResult = await k8sApi.appsClient.readNamespacedDeployment(
    workloadName, namespace);
  const deployment = deploymentResult.body;

  return {
    kind: 'Deployment',
    objectMeta: deployment.metadata,
    specMeta: deployment.spec.template.metadata,
    containers: deployment.spec.template.spec.containers,
    ownerRefs: deployment.metadata.ownerReferences,
  };
};

const replicaSetReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const replicaSetResult = await k8sApi.appsClient.readNamespacedReplicaSet(
    workloadName, namespace);
  const replicaSet = replicaSetResult.body;

  return {
    kind: 'ReplicaSet',
    objectMeta: replicaSet.metadata,
    specMeta: replicaSet.spec.template.metadata,
    containers: replicaSet.spec.template.spec.containers,
    ownerRefs: replicaSet.metadata.ownerReferences,
  };
};

const statefulSetReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const statefulSetResult = await k8sApi.appsClient.readNamespacedStatefulSet(
    workloadName, namespace);
  const statefulSet = statefulSetResult.body;

  return {
    kind: 'StatefulSet',
    objectMeta: statefulSet.metadata,
    specMeta: statefulSet.spec.template.metadata,
    containers: statefulSet.spec.template.spec.containers,
    ownerRefs: statefulSet.metadata.ownerReferences,
  };
};

const daemonSetReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const daemonSetResult = await k8sApi.appsClient.readNamespacedDaemonSet(
    workloadName, namespace);
  const daemonSet = daemonSetResult.body;

  return {
    kind: 'DaemonSet',
    objectMeta: daemonSet.metadata,
    specMeta: daemonSet.spec.template.metadata,
    containers: daemonSet.spec.template.spec.containers,
    ownerRefs: daemonSet.metadata.ownerReferences,
  };
};

const jobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const jobResult = await k8sApi.batchClient.readNamespacedJob(
    workloadName, namespace);
  const job = jobResult.body;

  return {
    kind: 'Job',
    objectMeta: job.metadata,
    specMeta: job.spec.template.metadata,
    containers: job.spec.template.spec.containers,
    ownerRefs: job.metadata.ownerReferences,
  };
};

// Keep an eye on this! We need v1beta1 API for CronJobs.
// https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
// CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
const cronJobReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const cronJobResult = await k8sApi.batchUnstableClient.readNamespacedCronJob(
    workloadName, namespace);
  const cronJob = cronJobResult.body;

  return {
    kind: 'CronJob',
    objectMeta: cronJob.metadata,
    specMeta: cronJob.spec.jobTemplate.metadata,
    containers: cronJob.spec.jobTemplate.spec.template.spec.containers,
    ownerRefs: cronJob.metadata.ownerReferences,
  };
};

const replicationControllerReader: IWorkloadReaderFunc = async (workloadName, namespace) => {
  const replicationControllerResult = await k8sApi.coreClient.readNamespacedReplicationController(
    workloadName, namespace);
  const replicationController = replicationControllerResult.body;

  return {
    kind: 'ReplicationController',
    objectMeta: replicationController.metadata,
    specMeta: replicationController.spec.template.metadata,
    containers: replicationController.spec.template.spec.containers,
    ownerRefs: replicationController.metadata.ownerReferences,
  };
};

// Here we are using the "kind" property of a k8s object as a key to map it to a reader.
// This gives us a quick look up table where we can abstract away the internal implementation of reading a resource
// and just grab a generic handler/reader that does that for us (based on the "kind").
const workloadReader = {
  Deployment: deploymentReader,
  ReplicaSet: replicaSetReader,
  StatefulSet: statefulSetReader,
  DaemonSet: daemonSetReader,
  Job: jobReader,
  CronJob: cronJobReader,
  ReplicationController: replicationControllerReader,
};

export const SupportedWorkloadTypes = keys(workloadReader);

export function getWorkloadReader(workloadType: string): IWorkloadReaderFunc {
  return workloadReader[workloadType];
}

export function getSupportedWorkload(ownerRefs: V1OwnerReference[] | undefined): V1OwnerReference | undefined {
  return ownerRefs !== undefined
    ? ownerRefs.find((owner) => SupportedWorkloadTypes.includes(owner.kind))
    : undefined;
}
