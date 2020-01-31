import * as tap from 'tap';
import { V1Deployment } from '@kubernetes/client-node';

export function validateSecureConfiguration(test: tap, deployment: V1Deployment) {
  if (
    !deployment.spec ||
    !deployment.spec.template.spec ||
    !deployment.spec.template.spec.containers ||
    deployment.spec.template.spec.containers.length === 0 ||
    !deployment.spec.template.spec.containers[0].securityContext
  ) {
    test.fail('bad container spec or missing securityContext');
    return;
  }

  const securityContext =
    deployment.spec.template.spec.containers[0].securityContext;

  if (!securityContext.capabilities) {
    test.fail('missing capabilities section in pod securityContext');
    return;
  }

  test.same(
    securityContext.capabilities.drop,
    ['ALL'],
    'all capabilities are dropped',
  );

  if (securityContext.capabilities.add) {
    test.false(
      securityContext.capabilities.add.includes('SYS_ADMIN'),
      'CAP_SYS_ADMIN not added',
    );
  }

  test.ok(
    securityContext.readOnlyRootFilesystem === true,
    'readOnlyRootFilesystem is set',
  );

  tap.ok(securityContext.allowPrivilegeEscalation === false, 'must explicitly set allowPrivilegeEscalation to false');
  tap.ok(securityContext.privileged === false, 'must explicitly set privileged to false');
  tap.ok(securityContext.runAsNonRoot === true, 'must explicitly set runAsNonRoot to true');
  tap.ok(
    securityContext.runAsUser !== undefined &&
      securityContext.runAsUser >= 10001,
    'must explicitly set runAsUser to be 10001 or greater',
  );
  tap.ok(
    securityContext.runAsGroup !== undefined &&
      securityContext.runAsGroup >= 10001,
    'must explicitly set runAsGroup to be 10001 or greater',
  );
}

export function validateVolumeMounts(test: tap, deployment: V1Deployment) {
  if (
    !deployment.spec ||
    !deployment.spec.template.spec ||
    !deployment.spec.template.spec.containers ||
    deployment.spec.template.spec.containers.length === 0 ||
    !deployment.spec.template.spec.containers[0].volumeMounts
  ) {
    test.fail('bad container spec or missing volumeMounts');
    return;
  }

  const volumeMounts = deployment.spec.template.spec.containers[0].volumeMounts;

  const temporaryStorageMount = volumeMounts.find(
    (mount) => mount.name === 'temporary-storage',
  );
  if (!temporaryStorageMount) {
    test.fail('missing deployment mount "temporary-storage"');
    return;
  }

  test.same(
    temporaryStorageMount.mountPath,
    '/var/tmp',
    'deployment file mounts temporary storage at the expected path',
  );

  const dockerConfigMount = volumeMounts.find(
    (mount) => mount.name === 'docker-config',
  );
  if (!dockerConfigMount) {
    test.fail('missing deployment mount "docker-config"');
    return;
  }

  test.same(
    dockerConfigMount.readOnly,
    true,
    'docker-config is a read-only mount',
  );

  test.same(
    dockerConfigMount.mountPath,
    '/srv/app/.docker',
    'docker-config mount path is as expected',
  );
}
