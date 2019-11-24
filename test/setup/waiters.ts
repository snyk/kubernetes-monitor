import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';
import * as sleep from 'sleep-promise';

export const KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS = 600;

export async function waitForMonitorToBeReady(): Promise<void> {
  // Attempt to check if the monitor is Running.
  let podStartChecks = KUBERNETES_MONITOR_MAX_WAIT_TIME_SECONDS;

  while (podStartChecks-- > 0) {
    const isMonitorReady = await isMonitorInReadyState();
    if (isMonitorReady) {
      break;
    }

    await sleep(1000);
  }

  if (podStartChecks <= 0) {
    throw Error('The snyk-monitor did not become ready in the expected time');
  }
}

async function isMonitorInReadyState(): Promise<boolean> {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromDefault();
  const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

  // First make sure our monitor Pod exists (is deployed).
  const podsResponse = await k8sApi.listNamespacedPod('snyk-monitor');
  if (podsResponse.body.items.length === 0) {
    return false;
  }

  const monitorPod = podsResponse.body.items.find((pod) => pod.metadata !== undefined &&
    pod.metadata.name !== undefined && pod.metadata.name.includes('snyk-monitor'));
  if (monitorPod === undefined) {
    return false;
  }

  return monitorPod.status !== undefined && monitorPod.status.phase === 'Running';
}
