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
}

