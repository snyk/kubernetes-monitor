/***
 * consider using https://www.npmjs.com/package/kubernetes-client
 * currently it's better to not use this lib since version 9.0 is about to be
 * released and merged with oficial @kubernetes/client-node.
 * IMPORTANT:
 * see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.14/#-strong-api-overview-strong-
 */
import k8s = require('@kubernetes/client-node');
import { sendDepGraph } from '../../requests/homebase/v1';
import { getUniqueImages, pullImages } from '../images/images';
import { scanImages, ScanResult } from './image-scanner';

const kc = new k8s.KubeConfig();
// should be: kc.loadFromCluster;
kc.loadFromDefault();
const currentCluster = kc.getCurrentCluster();
if (!currentCluster) {
  throw new Error(`Couldnt connect to current cluster info`);
}
const k8sApi = kc.makeApiClient(k8s.Core_v1Api);

interface ScanResponse {
  imageMetadata: KubeImage[];
}

interface KubeImage {
  scope: string;
  image: string;
}

class KubeApiWrapper {
  public static async scan(): Promise<ScanResponse | undefined> {
    const imageMetadata = await this.getImageForAllNamespaces();
    if (!imageMetadata) {
      return undefined;
    }

    const allImages = imageMetadata.map((meta) => meta.image);
    const images = getUniqueImages(allImages);

    try {
      await pullImages(images);

      const depTrees: ScanResult[] = await scanImages(images);
      console.log(depTrees);

      // TODO(ivan): send the actual data
      await sendDepGraph({
        userId: '',
        imageLocator: '',
        agentId: '',
      });
    } catch (error) {
      console.log(error);
      return undefined;
    }

    return { imageMetadata };
  }

  private static async getImageForAllNamespaces(): Promise<
    KubeImage[] | undefined
  > {
    try {
      const response = await k8sApi.listPodForAllNamespaces();
      let output: KubeImage[] = [];
      for (const item of response.body.items) {
        if (!item.metadata.namespace.startsWith('kube') && currentCluster) {
          const { name: podName, namespace, creationTimestamp } = item.metadata;
          const images = item.spec.containers.map(
            ({ name: containerName, image }) => {
              return {
                scope: `${currentCluster.name}/${namespace}/${podName}`,
                status: item.status.phase,
                podCreationTime: creationTimestamp,
                image,
              };
            });
          output = output.concat([...images]);
        }
      }
      return output;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }
}

export = KubeApiWrapper;
