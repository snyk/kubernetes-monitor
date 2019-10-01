import { spawn, SpawnPromiseResult } from 'child-process-promise';
import logger = require('../common/logger');

export function exec(bin: string, ...args: string[]):
    Promise<SpawnPromiseResult> {
  if (process.env.DEBUG === 'true') {
    args.push('--debug');
  }

  return spawn(bin, args, { env: process.env, capture: [ 'stdout', 'stderr' ] })
    .catch((error) => {
      const message = (error && error.stderr) || 'Unknown reason';
      logger.warn({message, bin, args}, 'Could not spawn the process');
      throw error;
    });
}
