import * as plugin from 'snyk-docker-plugin';
import { DepGraphPayload, KubeImage } from '../../requests';

export interface ScanResult {
  image: string;
  dependencies: any;
}

export async function scanImages(images: string[]): Promise<ScanResult[]> {
  const scannedImages: ScanResult[] = [];

  for (const image of images) {
    await plugin.inspect(image)
      .then((result) => {
        scannedImages.push({
          image,
          dependencies: result.package.dependencies,
        });
      }, (error) => {
        console.log(`Could not scan the image ${image}: ${error.message}`);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  return scannedImages;
}

export function constructPayloads(scannedImages: ScanResult[],
                                  imageMetadata: KubeImage[]): DepGraphPayload[] {
  const results = scannedImages.map((scannedImage) => {
    const metadata = imageMetadata.find((meta) => meta.image === scannedImage.image);
    if (!metadata) {
      throw Error('Unexpected missing image'); // should never happen?
    }

    const { image, ...workloadLocator } = metadata;

    const imageLocator = {
      userLocator: '',
      imageId: '',
      ...workloadLocator,
    };

    return {
      imageLocator,
      agentId: '',
      dependencyGraph: scannedImage.dependencies,
    } as DepGraphPayload;
  });

  return results;
}
