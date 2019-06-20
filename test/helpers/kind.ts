import { exec } from 'child-process-promise';
import { resolve } from 'path';

export async function getKindConfigPath() {
  try {
    const parentDir = resolve(process.cwd());
    const kindPath = await exec('./kind get kubeconfig-path', {cwd: parentDir});
    return kindPath.stdout.replace(/[\n\t\r]/g, '');
  } catch (err) {
    throw new Error(`Couldn't execute proccess: ${err}`);
  }
}
