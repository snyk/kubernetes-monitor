import { platform } from 'os';
import { download } from '../platforms/kind';
import { throwIfEnvironmentVariableUnset } from './helpers';

export async function setupTester(): Promise<void> {
  const osDistro = platform();
  await download(osDistro, 'v0.7.0');
}

export async function validateRequiredEnvironment(): Promise<void> {
  console.log(
    'Checking for the required environment variables: DOCKER_HUB_RO_USERNAME, DOCKER_HUB_RO_PASSWORD',
  );
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_USERNAME');
  throwIfEnvironmentVariableUnset('DOCKER_HUB_RO_PASSWORD');
}
