import { pull } from './docker';

export async function pullImages(images: string[]): Promise<string[]> {
  const pulledImages: string[] = [];

  for (const image of images) {
    try {
      await pull(image);
      pulledImages.push(image);
    } catch (error) {
      console.log(`Failed to pull ${image}: ${error.message}`);
    }
  }

  return pulledImages;
}
