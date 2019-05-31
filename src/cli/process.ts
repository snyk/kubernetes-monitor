import { ChildProcessPromise, spawn, SpawnPromiseResult } from 'child-process-promise';

export function exec(bin: string, ...args: string[]):
    ChildProcessPromise<SpawnPromiseResult> {
  if (process.env.DEBUG === 'true') {
    args.push('--debug');
  }

  return spawn(bin, args, { env: process.env, capture: [ 'stdout', 'stderr' ] });
}
