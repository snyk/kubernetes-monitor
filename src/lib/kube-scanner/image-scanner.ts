import * as plugin from 'snyk-docker-plugin';

export interface ScanResult {
  image: string;
  pluginResult: any;
}

export async function scanImages(images: string[]): Promise<ScanResult[]> {
  const scannedImages: ScanResult[] = [];

  for (const image of images) {
    try {
      const result = await plugin.inspect(image);
      if (!result || !result.package || !result.package.dependencies) {
        throw Error('Unexpected empty result from docker-plugin');
      }
      scannedImages.push({
        image,
        pluginResult: result,
      });
    } catch (error) {
      console.log(`Could not scan the image ${image}: ${error.message}`);
    }
  }

  return scannedImages;
}
