import { pull } from './docker';

export async function pullImages(images: string[]) {
  // TODO(ivan): needs some rate limiting!
  const imagesPromises = images.map((image) => pull(image));
  const results = await Promise.all(imagesPromises).catch((error) => {
    console.log(error);
    throw error;
  });
  if (results.some((result) => result.code !== 0)) {
    throw new Error('Could not pull all images');
  }
}

export function getUniqueImages(images: string[]): string[] {
  const uniqueImages: string[] = [];
  for (const image of images) {
    if (!uniqueImages.includes(image)) {
      uniqueImages.push(image);
    }
  }
  return ['alpine'];
  // return uniqueImages;
}
