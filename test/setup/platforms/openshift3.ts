import { platform } from 'os';
import { download } from '../platforms/kind'; 

export async function setupTester(): Promise<void> {
  const osDistro = platform();
  await download(osDistro, 'v0.7.0');
}
