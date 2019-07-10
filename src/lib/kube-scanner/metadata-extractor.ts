import { V1OwnerReference, V1Pod } from '@kubernetes/client-node';
import { IKubeImage } from '../../transmitter/types';
import { currentClusterName } from './cluster';
import { KubeObjectMetadata } from './types';
import { getSupportedWorkload, getWorkloadReader } from './workload-reader';

const loopingThreshold = 20;

// Constructs the workload metadata based on a variety of k8s properties.
// https://www.notion.so/snyk/Kubernetes-workload-fields-we-should-collect-c60c8f0395f241978282173f4c133a34
function buildImageMetadata(workloadMeta: KubeObjectMetadata): IKubeImage[] {
  const { kind, group, objectMeta, specMeta, containers } = workloadMeta;

  const { name, namespace, labels, annotations, uid } = objectMeta;
  const images = containers.map(({ name: containerName, image }) => ({
      type: kind,
      name: name || 'unknown',
      namespace,
      labels: labels || {},
      annotations: annotations || {},
      uid,
      specLabels: specMeta.labels || {},
      specAnnotations: specMeta.annotations || {},
      containerName,
      imageName: image,
      cluster: currentClusterName,
      apiGroup: group,
    } as IKubeImage),
  );
  return images;
}

async function findParentWorkload(
  ownerRefs: V1OwnerReference[] | undefined,
  namespace: string,
): Promise<KubeObjectMetadata | undefined> {
  let ownerReferences = ownerRefs;
  let parentMetadata: KubeObjectMetadata | undefined;

  for (let i = 0; i < loopingThreshold; i++) {
    // We are interested only in a subset of all workloads.
    const supportedWorkload = getSupportedWorkload(ownerReferences);

    if (supportedWorkload === undefined) {
      // Reached the top (or an unsupported workload): return the current parent metadata.
      return parentMetadata;
    }

    const workloadReader = getWorkloadReader(supportedWorkload.kind);
    parentMetadata = await workloadReader(supportedWorkload.name, namespace);
    ownerReferences = parentMetadata.ownerRefs;
  }

  return undefined;
}

export async function buildMetadataForWorkload(pod: V1Pod): Promise<IKubeImage[] | undefined> {
  const isAssociatedWithParent = isPodAssociatedWithParent(pod);

  // Pods that are not associated with any workloads
  // do not need to be read with the API (we already have their meta+spec)
  // so just return the information directly.
  if (!isAssociatedWithParent) {
    return buildImageMetadata({
      kind: 'Pod', // Reading pod.kind may be undefined, so use this
      group: extractApiGroup(pod.apiVersion),
      objectMeta: pod.metadata,
      // Notice the pod.metadata repeats; this is because pods
      // do not have the "template" property.
      specMeta: pod.metadata,
      ownerRefs: [],
      containers: pod.spec.containers,
    });
  }

  const podOwner: KubeObjectMetadata | undefined = await findParentWorkload(
    pod.metadata.ownerReferences, pod.metadata.namespace);

  return podOwner === undefined
    ? undefined
    : buildImageMetadata(podOwner);
}

export function isPodAssociatedWithParent(pod: V1Pod): boolean {
  return pod.metadata.ownerReferences !== undefined
  ? pod.metadata.ownerReferences.some((owner) => !!owner.kind)
  : false;
}

export function extractApiGroup(apiVersion: string): string {
  if (apiVersion) {
    const [group, version] = apiVersion.split('/');
    // resource may not be related to api group, for example apiVersion for pod would look like 'v1'
    if (group && version) {
      return group;
    }
  }
  return '';
}
