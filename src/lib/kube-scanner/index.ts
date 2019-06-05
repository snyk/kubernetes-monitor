/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import k8s = require('@kubernetes/client-node');
import { sendDepGraph } from '../../requests';
import { DepGraphPayload, KubeImage, ScanResponse } from '../../requests/types';
import { pullImages } from '../images/images';
import { constructPayloads, scanImages, ScanResult } from './image-scanner';

const kc = new k8s.KubeConfig();
// should be: kc.loadFromCluster;
kc.loadFromDefault();
const currentCluster = kc.getCurrentCluster();
if (!currentCluster) {
  throw new Error(`Couldnt connect to current cluster info`);
}
const k8sApi = kc.makeApiClient(k8s.Core_v1Api);

class KubeApiWrapper {
  public static async scan(): Promise<ScanResponse> {
    const imageMetadata = await this.getImageForAllNamespaces();

    const allImages = imageMetadata.map((meta) => meta.image);
    const uniqueImages = [...new Set<string>(allImages)];

    const pulledImages = await pullImages(uniqueImages);

    const scannedImages: ScanResult[] = await scanImages(pulledImages);
    const payloads: DepGraphPayload[] = constructPayloads(scannedImages, imageMetadata);

    await sendDepGraph(...payloads);

    const pulledImageMetadata = imageMetadata.filter((meta) =>
      pulledImages.includes(meta.image));
    return { imageMetadata: pulledImageMetadata };
  }

  private static async getImageForAllNamespaces(): Promise<KubeImage[]> {
    let output: KubeImage[] = [];

    let response;
    try {
      response = await k8sApi.listPodForAllNamespaces();
    } catch (err) {
      console.log('ERROR LISTING POD FOR ALL NAMESPACES');
      throw err;
    }

    if (!response || !response.body || !currentCluster) {
      return output;
    }

    for (const item of response.body.items) {
      if (item.metadata.namespace.startsWith('kube')) {
        continue;
      }

      const { name, namespace, creationTimestamp } = item.metadata;
      const images = item.spec.containers.map(
        ({ name: containerName, image }) => ({
            cluster: currentCluster.name,
            namespace,
            name,
            type: item.kind || '',
            status: item.status.phase,
            podCreationTime: creationTimestamp,
            image,
          } as KubeImage),
        );
      output = output.concat([...images]);
    }

    return output;
  }
}

export = KubeApiWrapper;
