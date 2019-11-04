import * as tap from 'tap';
import { parse } from 'yaml';
import { readFileSync } from 'fs';
import { V1Deployment } from '@kubernetes/client-node';
import * as snykConfig from '../../src/common/config';

tap.test('ensure the security properties of the deployment files are unchanged', async (t) => {
  const deploymentFiles = ['./snyk-monitor/templates/deployment.yaml', './snyk-monitor-deployment.yaml'];

  for (const filePath of deploymentFiles) {
    const fileContent = readFileSync(filePath, 'utf8');
    const deployment: V1Deployment = parse(fileContent);

    if (
      !deployment.spec ||
      !deployment.spec.template.spec ||
      !deployment.spec.template.spec.containers ||
      deployment.spec.template.spec.containers.length === 0 ||
      !deployment.spec.template.spec.containers[0].securityContext
    ) {
      tap.fail('bad container spec or missing securityContext');
      return;
    }

    const securityContext =
      deployment.spec.template.spec.containers[0].securityContext;

    if (!securityContext.capabilities) {
      tap.fail('missing capabilities section in pod securityContext');
      return;
    }

    tap.same(
      securityContext.capabilities,
      { drop: ['ALL'] },
      'all capabilities are dropped and none are added',
    );

    tap.ok(securityContext.readOnlyRootFilesystem === true, 'readOnlyRootFilesystem is set');
  }
});

tap.test('ensure temporary storage is mounted at the right path', async (t) => {
  t.same(snykConfig.IMAGE_STORAGE_ROOT, '/var/tmp', 'the snyk-monitor points to the correct mounted path');

  const deploymentFiles = ['./snyk-monitor/templates/deployment.yaml', './snyk-monitor-deployment.yaml'];

  for (const filePath of deploymentFiles) {
    const fileContent = readFileSync(filePath, 'utf8');
    const deployment: V1Deployment = parse(fileContent);

    if (
      !deployment.spec ||
      !deployment.spec.template.spec ||
      !deployment.spec.template.spec.containers ||
      deployment.spec.template.spec.containers.length === 0 ||
      !deployment.spec.template.spec.containers[0].volumeMounts
    ) {
      tap.fail('bad container spec or missing volumeMounts');
      return;
    }

    const volumeMounts =
      deployment.spec.template.spec.containers[0].volumeMounts;
    const temporaryStorageMount = volumeMounts.find((mount) => mount.name === 'temporary-storage');
    if (temporaryStorageMount === undefined) {
      tap.fail('missing deployment mount "temporary-storage"');
      return;
    }

    tap.same(
      temporaryStorageMount.mountPath,
      '/var/tmp',
      'deployment file mounts temporary storage at the expected path',
    );
  }
});
