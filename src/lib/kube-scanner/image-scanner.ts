import * as plugin from 'snyk-docker-plugin';

export interface ScanResult {
  dependencies: any;
}

export async function scanImages(images: string[]): Promise<ScanResult[]> {
  const scannedImages: ScanResult[] = [];

  for (const image of images) {
    await plugin.inspect(image)
      .then((result) => {
        scannedImages.push({
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
