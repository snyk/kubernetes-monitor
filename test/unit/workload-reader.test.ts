import * as tap from 'tap';

import { SupportedWorkloadTypes, getSupportedWorkload } from '../../src/supervisor/workload-reader';
import { V1OwnerReference } from '@kubernetes/client-node';

tap.test('SupportedWorkloadTypes', async (t) => {
  t.ok(SupportedWorkloadTypes.indexOf('Deployment') > -1, 'Deployment is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('ReplicaSet') > -1, 'ReplicaSet is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('StatefulSet') > -1, 'StatefulSet is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('DaemonSet') > -1, 'DaemonSet is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('Job') > -1, 'Job is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('CronJob') > -1, 'CronJob is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('ReplicationController') > -1, 'ReplicationController is a supported workload');
});

tap.test('getSupportedWorkload()', async (t) => {
  t.same(getSupportedWorkload(undefined), undefined, 'returns undefined on receiving undefined');
  t.same(getSupportedWorkload([]), undefined, 'returns undefined on empty list');

  const unsupportedOwnerRefs = [
    { kind: 'B7', controller: true },
    { kind: ':egg:', controller: true },
  ];
  t.same(
    getSupportedWorkload(unsupportedOwnerRefs as V1OwnerReference[]),
    undefined,
    'returns undefined when there is no match in a list',
  );

  const noController = [{ kind: 'ReplicaSet' }, { kind: 'Deployment' }];
  t.same(
    getSupportedWorkload(noController as V1OwnerReference[]),
    undefined,
    'returns undefined when no OwnerReference is a controller',
  );

  const oneController = [
    { kind: 'ReplicaSet' },
    { kind: 'Deployment', controller: true },
  ];
  t.same(
    getSupportedWorkload(oneController as V1OwnerReference[]),
    { kind: 'Deployment', controller: true },
    'returns the only controller in a list',
  );

  const twoControllers = [
    { kind: 'ReplicaSet', controller: true },
    { kind: 'Deployment', controller: true },
  ];
  t.same(
    getSupportedWorkload(twoControllers as V1OwnerReference[]),
    { kind: 'ReplicaSet', controller: true },
    'returns the first controller in a list',
  );
});
