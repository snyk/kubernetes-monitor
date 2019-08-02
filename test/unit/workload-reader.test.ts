import * as tap from 'tap';

import { SupportedWorkloadTypes } from '../../src/kube-scanner/workload-reader';

tap.test('SupportedWorkloadTypes', async (t) => {
  t.ok(SupportedWorkloadTypes.indexOf('Deployment') > -1, 'Deployment is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('ReplicaSet') > -1, 'ReplicaSet is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('StatefulSet') > -1, 'StatefulSet is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('DaemonSet') > -1, 'DaemonSet is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('Job') > -1, 'Job is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('CronJob') > -1, 'CronJob is a supported workload');
  t.ok(SupportedWorkloadTypes.indexOf('ReplicationController') > -1, 'ReplicationController is a supported workload');
});
