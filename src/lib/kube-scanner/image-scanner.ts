import * as plugin from 'snyk-docker-plugin';

export interface ScanResult {
  dependencies: any;
}

export async function scanImages(images: string[]): Promise<ScanResult[]> {
  const inspectPromises = images.map((image) => plugin.inspect(image));
  const results = await Promise.all(inspectPromises).catch((error) => {
    console.log(error);
    throw error;
  });
  return results.map((result) => {
    return {
      dependencies: result.package.dependencies,
    };
  });
}
