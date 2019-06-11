import k8s = require('@kubernetes/client-node');
import { exec } from 'child-process-promise';
import path = require('path');
import sleep = require('sleep-promise');
import { test } from 'tap';
import * as config from '../../src/common/config';

const kc = new k8s.KubeConfig();

const getKindConfigPath = async () => {
  try {
    const parentDir = path.resolve(process.cwd());
    const kindPath = await exec('./kind get kubeconfig-path', {cwd: parentDir});
    return kindPath.stdout.replace(/[\n\t\r]/g, '');
  } catch (err) {
    throw new Error(`Couldn't execute proccess: ${err}`);
  }
};

test('egg monitor container started', async t => {
  // wait to let the container go through a cycle
  await sleep(config.MONITOR.INITIAL_REFRESH_MS);
  const kindPath = await getKindConfigPath();
  kc.loadFromFile(kindPath);
  const k8sApi = kc.makeApiClient(k8s.Core_v1Api);
  t.notEqual(
    kc.getCurrentCluster(),
    undefined,
    'Kind cluster instance is not empty',
  );
  const response = await k8sApi.listNamespacedPod('default');
  t.ok(response.body.items.length > 0, 'PodList is not empty');
  for (const item of response.body.items) {
    if (item.metadata.namespace.startsWith('kube')) {
      continue;
    }
    t.ok(item.metadata.name.includes('snyk-egg'), 'Egg container exists');
    // All pod phases could be found here: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase
    t.notEqual(item.status.phase, 'Failed', `Egg container didn't failed`);
  }
});
