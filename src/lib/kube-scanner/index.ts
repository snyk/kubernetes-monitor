/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import k8s = require('@kubernetes/client-node');
import { V1PodList } from '@kubernetes/client-node';
import { Cluster } from '@kubernetes/client-node/dist/config_types';
import { isEmpty } from 'lodash';
import { sendDepGraph } from '../../transmitter';
import { DepGraphPayload, KubeImage, ScanResponse } from '../../transmitter/types';
import { pullImages } from '../images';
import { constructPayloads, scanImages, ScanResult } from './image-scanner';

function getCurrentCluster(k8sConfig: k8s.KubeConfig): Cluster {
  const cluster = k8sConfig.getCurrentCluster();
  if (cluster === null) {
    throw new Error(`Couldnt connect to current cluster info`);
  }
  return cluster;
}

// we should not be concerned with k8s-related namespaces
const IgnoredNamespace = 'kube';

const DefaultWorkloadType = 'Pod';
const SupportedWorkloadTypes = [
  'Deployment',
  'ReplicaSet',
  'StatefulSet',
  'DaemonSet',
  'CronJob',
  'ReplicationController',
];

const kc = new k8s.KubeConfig();
// should be: kc.loadFromCluster;
kc.loadFromDefault();
const currentCluster = getCurrentCluster(kc);
const k8sApi = kc.makeApiClient(k8s.Core_v1Api);

class KubeApiWrapper {
  public static async scan(): Promise<ScanResponse> {
    const imageMetadata = await this.getImageForAllNamespaces();

    const allImages = imageMetadata.map((meta) => meta.baseImageName);
    const uniqueImages = [...new Set<string>(allImages)];

    const pulledImages = await pullImages(uniqueImages);

    const scannedImages: ScanResult[] = await scanImages(pulledImages);
    const payloads: DepGraphPayload[] = constructPayloads(scannedImages, imageMetadata);

    await sendDepGraph(...payloads);

    const pulledImageMetadata = imageMetadata.filter((meta) =>
      pulledImages.includes(meta.baseImageName));
    return { imageMetadata: pulledImageMetadata };
  }

  private static async getImageForAllNamespaces(): Promise<KubeImage[]> {
    let imagesInAllNamespaces: KubeImage[] = [];

    let allPodsResponse: { body: V1PodList };
    try {
      allPodsResponse = await k8sApi.listPodForAllNamespaces();
    } catch (error) {
      console.log(`Could not list pods for all namespaces: ${error.message}`);
      throw error;
    }

    if (!allPodsResponse || !allPodsResponse.body) {
      return imagesInAllNamespaces;
    }

    for (const item of allPodsResponse.body.items) {
      if (item.metadata.namespace.startsWith(IgnoredNamespace)) {
        continue;
      }

      const podOwner = item.metadata.ownerReferences
        .find((owner) => SupportedWorkloadTypes.includes(owner.kind));
      const isAssociatedWithParent = item.metadata.ownerReferences
        .some((owner) => !isEmpty(owner.kind));

      if (podOwner === undefined && isAssociatedWithParent) {
        // Unsupported workload, continue
        continue;
      }

      const workloadType = (podOwner === undefined && !isAssociatedWithParent)
        ? DefaultWorkloadType
        : podOwner!.kind;

      const { name, namespace, creationTimestamp } = item.metadata;
      const images = item.spec.containers.map(
        ({ name: containerName, image }) => ({
            cluster: currentCluster.name,
            namespace,
            name,
            type: workloadType,
            status: item.status.phase,
            podCreationTime: creationTimestamp,
            baseImageName: image,
          } as KubeImage),
        );
      imagesInAllNamespaces = imagesInAllNamespaces.concat([...images]);
    }

    return imagesInAllNamespaces;
  }
}

export = KubeApiWrapper;
