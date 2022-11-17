import { KubernetesObject, V1Namespace } from '@kubernetes/client-node';
import LruCache from 'lru-cache';

import { config } from './common/config';
import { extractNamespaceName } from './supervisor/watchers/internal-namespaces';

const imagesLruCacheOptions: LruCache.Options<string, Set<string>> = {
  // limit cache size so we don't exceed memory limit
  max: config.IMAGES_SCANNED_CACHE.MAX_SIZE,
  // limit cache life so if our backend loses track of an image's data,
  // eventually we will report again for that image, if it's still relevant
  maxAge: config.IMAGES_SCANNED_CACHE.MAX_AGE_MS,
  updateAgeOnGet: false,
};

const workloadsLruCacheOptions: LruCache.Options<string, string> = {
  // limit cache size so we don't exceed memory limit
  max: config.WORKLOADS_SCANNED_CACHE.MAX_SIZE,
  // limit cache life so if our backend loses track of an image's data,
  // eventually we will report again for that image, if it's still relevant
  maxAge: config.WORKLOADS_SCANNED_CACHE.MAX_AGE_MS,
  updateAgeOnGet: false,
};

interface WorkloadAlreadyScanned {
  namespace: string;
  type: string;
  uid: string;
}

interface WorkloadImagesAlreadyScanned {
  namespace: string;
  type: string;
  uid: string;
  imageIds: string[];
}

function getWorkloadAlreadyScannedKey(
  workload: WorkloadAlreadyScanned,
): string {
  return `${workload.namespace}/${workload.type}/${workload.uid}`;
}

function getWorkloadImageAlreadyScannedKey(
  workload: WorkloadAlreadyScanned,
  imageName: string,
): string {
  return `${workload.namespace}/${workload.type}/${workload.uid}/${imageName}`;
}

export async function getWorkloadAlreadyScanned(
  workload: WorkloadAlreadyScanned,
): Promise<string | undefined> {
  const key = getWorkloadAlreadyScannedKey(workload);
  return state.workloadsAlreadyScanned.get(key);
}

export async function setWorkloadAlreadyScanned(
  workload: WorkloadAlreadyScanned,
  revision: string,
): Promise<boolean> {
  const key = getWorkloadAlreadyScannedKey(workload);
  return state.workloadsAlreadyScanned.set(key, revision);
}

export async function deleteWorkloadAlreadyScanned(
  workload: WorkloadAlreadyScanned,
): Promise<void> {
  const key = getWorkloadAlreadyScannedKey(workload);
  state.workloadsAlreadyScanned.del(key);
}

export async function getWorkloadImageAlreadyScanned(
  workload: WorkloadAlreadyScanned,
  imageName: string,
  imageId: string,
): Promise<string | undefined> {
  const key = getWorkloadImageAlreadyScannedKey(workload, imageName);
  const hasImageId = state.imagesAlreadyScanned.get(key)?.has(imageId);
  return hasImageId ? imageId : undefined;
}

export async function setWorkloadImageAlreadyScanned(
  workload: WorkloadAlreadyScanned,
  imageName: string,
  imageId: string,
): Promise<boolean> {
  const key = getWorkloadImageAlreadyScannedKey(workload, imageName);
  const images = state.imagesAlreadyScanned.get(key);
  if (images !== undefined) {
    images.add(imageId);
  } else {
    const set = new Set<string>();
    set.add(imageId);
    state.imagesAlreadyScanned.set(key, set);
  }

  return true;
}

export async function deleteWorkloadImagesAlreadyScanned(
  workload: WorkloadImagesAlreadyScanned,
): Promise<void> {
  for (const imageId of workload.imageIds) {
    const key = getWorkloadImageAlreadyScannedKey(workload, imageId);
    state.imagesAlreadyScanned.del(key);
  }
}

export function kubernetesObjectToWorkloadAlreadyScanned(
  workload: KubernetesObject,
): WorkloadAlreadyScanned | undefined {
  if (
    workload.metadata &&
    workload.metadata.namespace &&
    workload.metadata.uid &&
    workload.kind
  ) {
    return {
      namespace: workload.metadata.namespace,
      type: workload.kind,
      uid: workload.metadata.uid,
    };
  }
  return undefined;
}

export function storeNamespace(namespace: V1Namespace): void {
  const namespaceName = extractNamespaceName(namespace);
  state.watchedNamespaces[namespaceName] = namespace;
}

export function deleteNamespace(namespace: V1Namespace): void {
  const namespaceName = extractNamespaceName(namespace);
  delete state.watchedNamespaces[namespaceName];
}

export const state = {
  shutdownInProgress: false,
  imagesAlreadyScanned: new LruCache<string, Set<string>>(
    imagesLruCacheOptions,
  ),
  workloadsAlreadyScanned: new LruCache<string, string>(
    workloadsLruCacheOptions,
  ),
  watchedNamespaces: {} as Record<string, V1Namespace>,
};
