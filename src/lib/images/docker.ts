import { SpawnPromiseResult } from 'child-process-promise';
import { exec } from '../../cli/process';

export function pull(image: string, userArgs?: string[]): Promise<SpawnPromiseResult> {
  const args = [image];
  if (userArgs) {
    args.concat(userArgs);
  }

  return exec('docker', 'pull', ...args);
}
