import { spawn, SpawnPromiseResult } from 'child-process-promise';
import logger = require('../common/logger');

export function exec(bin: string, ...args: string[]):
    Promise<SpawnPromiseResult> {
  if (process.env.DEBUG === 'true') {
    args.push('--debug');
  }

  // Ensure we're not passing the whole environment to the shelled out process...
  // For example, that process doesn't need to know secrets like our integrationId!
  const env = {
    PATH: process.env.PATH,
  };

  return spawn(bin, args, { env, capture: [ 'stdout', 'stderr' ] })
    .catch((error) => {
      const message = (error && error.stderr) || 'Unknown reason';
      logger.warn({message, bin, args}, 'could not spawn the process');
      throw error;
    });
}
