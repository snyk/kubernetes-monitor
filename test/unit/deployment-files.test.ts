import * as tap from 'tap';
import { parse } from 'yaml';
import { readFileSync } from 'fs';
import { V1Deployment } from '@kubernetes/client-node';

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

    tap.same(securityContext.capabilities, { drop: ['ALL'] }, 'all capabilities are dropped and none are added');
    tap.ok(securityContext.allowPrivilegeEscalation === false, 'must explicitly set allowPrivilegeEscalation to false');
    tap.ok(securityContext.privileged === false, 'must explicitly set privileged to false');
    tap.ok(securityContext.runAsNonRoot === true, 'must explicitly set runAsNonRoot to true');
    tap.ok(securityContext.runAsUser === 10001, 'must explicitly set runAsUser to 10001');
    tap.ok(securityContext.runAsGroup === 10001, 'must explicitly set runAsGroup to 10001');

    // TODO: currently we do not set this to true because skopeo pulls
    // temporary files to /var/tmp and this behaviour is not configurable
    // To be secure, this value MUST be set to "true"!
    tap.ok(securityContext.readOnlyRootFilesystem === false, 'readOnlyRootFilesystem is not set ON PURPOSE');
  }
});
