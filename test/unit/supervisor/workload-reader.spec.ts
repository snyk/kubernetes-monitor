import {
  SupportedWorkloadTypes,
  getSupportedWorkload,
} from '../../../src/supervisor/workload-reader';
import { V1OwnerReference } from '@kubernetes/client-node';

describe('workload reader tests', () => {
  test.concurrent('SupportedWorkloadTypes', async () => {
    expect(SupportedWorkloadTypes.indexOf('Deployment') > -1).toEqual(true);
    expect(SupportedWorkloadTypes.indexOf('ReplicaSet') > -1).toEqual(true);
    expect(SupportedWorkloadTypes.indexOf('StatefulSet') > -1).toEqual(true);
    expect(SupportedWorkloadTypes.indexOf('DaemonSet') > -1).toEqual(true);
    expect(SupportedWorkloadTypes.indexOf('Job') > -1).toEqual(true);
    expect(SupportedWorkloadTypes.indexOf('CronJob') > -1).toEqual(true);
    expect(
      SupportedWorkloadTypes.indexOf('ReplicationController') > -1,
    ).toEqual(true);
  });

  test.concurrent('getSupportedWorkload()', async () => {
    expect(getSupportedWorkload(undefined)).toBeUndefined();
    expect(getSupportedWorkload([])).toBeUndefined();

    const unsupportedOwnerRefs = [
      { kind: 'B7', controller: true },
      { kind: ':egg:', controller: true },
    ];
    expect(
      getSupportedWorkload(unsupportedOwnerRefs as V1OwnerReference[]),
    ).toBeUndefined();

    // Selects the first one that matches a supported workload
    const noController = [{ kind: 'ReplicaSet' }, { kind: 'Deployment' }];
    expect(getSupportedWorkload(noController as V1OwnerReference[])).toEqual({
      kind: 'ReplicaSet',
    });

    // Selects the first one that matches a supported workload, regardless of controllers
    const oneController = [
      { kind: 'ReplicaSet' },
      { kind: 'Deployment', controller: true },
    ];
    expect(getSupportedWorkload(oneController as V1OwnerReference[])).toEqual({
      kind: 'ReplicaSet',
    });

    const twoControllers = [
      { kind: 'ReplicaSet', controller: true },
      { kind: 'Deployment', controller: true },
    ];
    expect(getSupportedWorkload(twoControllers as V1OwnerReference[])).toEqual({
      kind: 'ReplicaSet',
      controller: true,
    });
  });
});
