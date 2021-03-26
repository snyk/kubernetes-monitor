import { parse } from 'yaml';
import { readFileSync } from 'fs';
import { V1Deployment } from '@kubernetes/client-node';
import { config } from '../../src/common/config';

/**
 * Note that these checks are also performed at runtime on the deployed snyk-monitor, see the integration tests.
 */

test('ensure the security properties of the deployment files are unchanged', async () => {
  expect(config.IMAGE_STORAGE_ROOT).toEqual('/var/tmp');

  const deploymentFiles = ['./snyk-monitor-deployment.yaml'];

  for (const filePath of deploymentFiles) {
    const fileContent = readFileSync(filePath, 'utf8');
    const deployment: V1Deployment = parse(fileContent);

    validateSecureConfiguration(deployment);
    validateVolumeMounts(deployment);
    validateEnvironmentVariables(deployment);
  }
});

export function validateEnvironmentVariables(deployment: V1Deployment) {
  if (
    !deployment.spec ||
    !deployment.spec.template.spec ||
    !deployment.spec.template.spec.containers ||
    deployment.spec.template.spec.containers.length === 0 ||
    !deployment.spec.template.spec.containers[0].env
  ) {
    fail('bad container spec or missing env');
  }

  const env = deployment.spec.template.spec.containers[0].env;

  const envHasHomeEntry = env.some(
    (entry) => entry.name === 'HOME' && entry.value === '/srv/app',
  );
  expect(envHasHomeEntry).toBeTruthy();
}

export function validateSecureConfiguration(deployment: V1Deployment) {
  if (
    !deployment.spec ||
    !deployment.spec.template.spec ||
    !deployment.spec.template.spec.containers ||
    deployment.spec.template.spec.containers.length === 0 ||
    !deployment.spec.template.spec.containers[0].securityContext
  ) {
    fail('bad container spec or missing securityContext');
  }

  const securityContext =
    deployment.spec.template.spec.containers[0].securityContext;

  if (!securityContext.capabilities) {
    fail('missing capabilities section in pod securityContext');
  }

  expect(securityContext.capabilities.drop).toEqual(['ALL']);

  if (securityContext.capabilities.add) {
    expect(securityContext.capabilities.add.includes('SYS_ADMIN')).toEqual(
      false,
    );
  }

  expect(securityContext.readOnlyRootFilesystem).toEqual(true);

  expect(securityContext.allowPrivilegeEscalation).toEqual(false);
  expect(securityContext.privileged).toEqual(false);
  expect(securityContext.runAsNonRoot).toEqual(true);
}

export function validateVolumeMounts(deployment: V1Deployment) {
  if (
    !deployment.spec ||
    !deployment.spec.template.spec ||
    !deployment.spec.template.spec.containers ||
    deployment.spec.template.spec.containers.length === 0 ||
    !deployment.spec.template.spec.containers[0].volumeMounts
  ) {
    fail('bad container spec or missing volumeMounts');
  }

  const volumeMounts = deployment.spec.template.spec.containers[0].volumeMounts;

  const temporaryStorageMount = volumeMounts.find(
    (mount) => mount.name === 'temporary-storage',
  );
  if (!temporaryStorageMount) {
    fail('missing deployment mount "temporary-storage"');
  }

  expect(temporaryStorageMount.mountPath).toEqual('/var/tmp');

  const dockerConfigMount = volumeMounts.find(
    (mount) => mount.name === 'docker-config',
  );
  if (!dockerConfigMount) {
    fail('missing deployment mount "docker-config"');
  }

  expect(dockerConfigMount.readOnly).toEqual(true);
  expect(dockerConfigMount.mountPath).toEqual('/srv/app/.docker');
}
