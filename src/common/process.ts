import { spawn, SpawnPromiseResult } from 'child-process-promise';
import logger = require('./logger');

export interface IProcessArgument {
  body: string;
  sanitise: boolean;
}

export function exec(bin: string, ...processArgs: IProcessArgument[]):
    Promise<SpawnPromiseResult> {
  if (process.env.DEBUG === 'true') {
    processArgs.push({body: '--debug', sanitise: false});
  }

  // Ensure we're not passing the whole environment to the shelled out process...
  // For example, that process doesn't need to know secrets like our integrationId!
  const env = {
    PATH: process.env.PATH,
  };

  const allArguments = processArgs.map((arg) => arg.body);
  return spawn(bin, allArguments, { env, capture: [ 'stdout', 'stderr' ] })
    .catch((error) => {
      const message = (error && error.stderr) || 'Unknown reason';
      const loggableArguments = processArgs.filter((arg) => !arg.sanitise).map((arg) => arg.body);
      logger.warn({message, bin, loggableArguments}, 'child process failure');
      throw error;
    });
}
