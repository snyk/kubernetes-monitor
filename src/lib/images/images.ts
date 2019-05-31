import { pull } from './docker';

export async function pullImages(images: string[]) {
  const imagesPromises = images.map((image) => pull(image));
  const results = await Promise.all(imagesPromises).catch((error) => {
    console.log(error);
    throw error;
  });
  if (results.some((result) => result.code !== 0)) {
    throw new Error('Could not pull all images');
  }
}
