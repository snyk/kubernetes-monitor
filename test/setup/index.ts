import { execWrapper as exec } from '../helpers/exec';

const testPlatform = process.env['TEST_PLATFORM'] || 'kind';

export function snykMonitorNamespace(): string {
  let namespace = 'snyk-monitor';
  if (testPlatform === 'kindolm') {
    namespace = 'marketplace';
  }

  return namespace;
}

export async function removeLocalContainerRegistry(): Promise<void> {
  try {
    await exec('docker rm kind-registry --force');
  } catch (error: any) {
    console.log(
      `Could not remove container registry, it probably did not exist: ${error.message}`,
    );
  }
}

export async function removeUnusedKindNetwork(): Promise<void> {
  try {
    await exec('docker network rm kind');
  } catch (error: any) {
    console.log(`Could not remove "kind" network: ${error.message}`);
  }
}
