/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import { V1PodList } from '@kubernetes/client-node';
import { sendDepGraph } from '../../transmitter';
import { IDepGraphPayload, IKubeImage, IScanResponse } from '../../transmitter/types';
import { pullImages } from '../images';
import { k8sApi } from './cluster';
import { constructHomebaseWorkloadPayloads, scanImages, ScanResult } from './image-scanner';
import { buildMetadataForWorkload } from './metadata-extractor';

// we should not be concerned with k8s-related namespaces
const IgnoredNamespace = 'kube';

class KubeApiWrapper {
  public static async scan(): Promise<IScanResponse> {
    const workloadMetadata = await this.getAllWorkloads();

    const allImages = workloadMetadata.map((meta) => meta.imageName);
    const uniqueImages = [...new Set<string>(allImages)];

    const pulledImages = await pullImages(uniqueImages);

    const scannedImages: ScanResult[] = await scanImages(pulledImages);
    const homebasePayloads: IDepGraphPayload[] = constructHomebaseWorkloadPayloads(scannedImages, workloadMetadata);

    await sendDepGraph(...homebasePayloads);

    const pulledImageMetadata = workloadMetadata.filter((meta) =>
      pulledImages.includes(meta.imageName));
    return { imageMetadata: pulledImageMetadata };
  }

  private static async getAllWorkloads(): Promise<IKubeImage[]> {
    let imagesInAllNamespaces: IKubeImage[] = [];

    let allPodsResponse: { body: V1PodList };
    try {
      allPodsResponse = await k8sApi.coreClient.listPodForAllNamespaces();
    } catch (error) {
      console.log(`Could not list pods for all namespaces: ${error.message}`);
      throw error;
    }

    if (!allPodsResponse || !allPodsResponse.body) {
      return imagesInAllNamespaces;
    }

    for (const pod of allPodsResponse.body.items) {
      if (pod.metadata.namespace.startsWith(IgnoredNamespace)) {
        continue;
      }

      try {
        const imagesMetadata = await buildMetadataForWorkload(pod);
        if (imagesMetadata !== undefined && imagesMetadata.length > 0) {
          imagesInAllNamespaces = imagesInAllNamespaces.concat([...imagesMetadata]);
        }
      } catch (error) {
        console.log(`Could not build image metadata for pod ${pod.metadata.name}: ${error.message}`);
        throw error;
      }
    }

    return imagesInAllNamespaces;
  }
}

export = KubeApiWrapper;
