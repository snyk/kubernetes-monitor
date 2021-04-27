import {
  V1OwnerReference,
  V1Pod,
  V1Container,
  V1ContainerStatus,
  V1PodSpec,
} from '@kubernetes/client-node';
import { IWorkload, ILocalWorkloadLocator } from '../transmitter/types';
import { currentClusterName } from './cluster';
import { IKubeObjectMetadata } from './types';
import { getSupportedWorkload, getWorkloadReader } from './workload-reader';
import { logger } from '../common/logger';

const loopingThreshold = 20;

// Constructs the workload metadata based on a variety of k8s properties.
// https://www.notion.so/snyk/Kubernetes-workload-fields-we-should-collect-c60c8f0395f241978282173f4c133a34
export function buildImageMetadata(
  workloadMeta: IKubeObjectMetadata,
  containerStatuses: V1ContainerStatus[],
): IWorkload[] {
  const { kind, objectMeta, specMeta, revision, podSpec } = workloadMeta;
  const { name, namespace, labels, annotations, uid } = objectMeta;

  const containerNameToSpec: { [key: string]: V1Container } = {};
  for (const container of podSpec.containers) {
    containerNameToSpec[container.name] = container;
  }

  const containerNameToStatus: { [key: string]: V1ContainerStatus } = {};
  for (const containerStatus of containerStatuses) {
    containerNameToStatus[containerStatus.name] = containerStatus;
  }

  const images: IWorkload[] = [];
  for (const containerStatus of containerStatuses) {
    if (!(containerStatus.name in containerNameToSpec)) {
      continue;
    }
    images.push({
      type: kind,
      name: name || 'unknown',
      namespace,
      labels: labels || {},
      annotations: annotations || {},
      uid,
      specLabels: specMeta.labels || {},
      specAnnotations: specMeta.annotations || {},
      containerName: containerStatus.name,
      imageName: containerNameToSpec[containerStatus.name].image,
      imageId: containerNameToStatus[containerStatus.name].imageID,
      cluster: currentClusterName,
      revision,
      podSpec,
    } as IWorkload);
  }

  return images;
}

async function findParentWorkload(
  podSpec: V1PodSpec,
  ownerRefs: V1OwnerReference[] | undefined,
  namespace: string,
): Promise<IKubeObjectMetadata | undefined> {
  let ownerReferences = ownerRefs;
  let parentMetadata: IKubeObjectMetadata | undefined;

  for (let i = 0; i < loopingThreshold; i++) {
    // We are interested only in a subset of all workloads.
    const supportedWorkload = getSupportedWorkload(ownerReferences);

    if (supportedWorkload === undefined) {
      // Reached the top (or an unsupported workload): return the current parent metadata.
      return parentMetadata;
    }

    const workloadReader = getWorkloadReader(supportedWorkload.kind);
    try {
      const workloadMetadata = await workloadReader(
        supportedWorkload.name,
        namespace,
      );
      if (workloadMetadata === undefined) {
        // Could not extract data for the next parent, so return whatever we have so far.
        return parentMetadata;
      }
      parentMetadata = { ...workloadMetadata, podSpec };
      ownerReferences = parentMetadata.ownerRefs;
    } catch (err) {
      if (
        err &&
        err.response &&
        err.response.body &&
        err.response.body.code === 404
      ) {
        logger.info(
          {
            name: supportedWorkload.name,
            kind: supportedWorkload.kind,
            namespace,
          },
          'could not find workload, it probably no longer exists',
        );
        return undefined;
      }
      throw err;
    }
  }

  return undefined;
}

export function buildWorkloadMetadata(
  kubernetesMetadata: IKubeObjectMetadata,
): ILocalWorkloadLocator {
  if (
    !kubernetesMetadata.objectMeta ||
    kubernetesMetadata.objectMeta.namespace === undefined ||
    kubernetesMetadata.objectMeta.name === undefined
  ) {
    throw new Error("can't build workload metadata for object");
  }

  return {
    type: kubernetesMetadata.kind,
    name: kubernetesMetadata.objectMeta.name,
    namespace: kubernetesMetadata.objectMeta.namespace,
  };
}

export function isPodAssociatedWithParent(pod: V1Pod): boolean {
  return pod.metadata !== undefined &&
    pod.metadata.ownerReferences !== undefined
    ? pod.metadata.ownerReferences.some((owner) => !!owner.kind)
    : false;
}

export async function buildMetadataForWorkload(
  pod: V1Pod,
): Promise<IWorkload[] | undefined> {
  const isAssociatedWithParent = isPodAssociatedWithParent(pod);

  if (!pod.metadata || pod.metadata.namespace === undefined || !pod.spec) {
    // Some required parameters are missing, we cannot process further
    return undefined;
  }

  if (!(pod.status && pod.status.containerStatuses)) {
    logger.warn({ pod }, 'pod lacks status or status.containerStatus');
    return undefined;
  }

  // Pods that are not associated with any workloads
  // do not need to be read with the API (we already have their meta+spec)
  // so just return the information directly.
  if (!isAssociatedWithParent) {
    return buildImageMetadata(
      {
        kind: 'Pod', // Reading pod.kind may be undefined, so use this
        objectMeta: pod.metadata,
        // Notice the pod.metadata repeats; this is because pods
        // do not have the "template" property.
        specMeta: pod.metadata,
        ownerRefs: [],
        podSpec: pod.spec,
      },
      pod.status.containerStatuses,
    );
  }

  const podOwner: IKubeObjectMetadata | undefined = await findParentWorkload(
    pod.spec,
    pod.metadata.ownerReferences,
    pod.metadata.namespace,
  );

  if (podOwner === undefined) {
    logger.info(
      { pod },
      'pod associated with owner, but owner not found. not building metadata.',
    );
    return undefined;
  }

  return buildImageMetadata(podOwner, pod.status.containerStatuses);
}
