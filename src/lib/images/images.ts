import { pull } from './docker';

export async function pullImages(images: string[]): Promise<string[]> {
  const pulledImages: string[] = [];

  for (const image of images) {
    await pull(image)
      .then(() => {
        pulledImages.push(image);
      }, (error) => {
        console.log(`Failed to pull ${image}: ${error.message}`);
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  }

  return pulledImages;
}

export function getUniqueImages(images: string[]): string[] {
  const uniqueImages: string[] = [];
  for (const image of images) {
    if (!uniqueImages.includes(image)) {
      uniqueImages.push(image);
    }
  }
  return uniqueImages;
}
