import { config } from '../common/config';
import { currentClusterName } from '../supervisor/cluster';
import { IScanResult } from '../scanner/types';
import {
  IWorkload,
  ILocalWorkloadLocator,
  IImageLocator,
  IWorkloadMetadataPayload,
  IWorkloadMetadata,
  IWorkloadLocator,
  ScanResultsPayload,
  IDependencyGraphPayload,
  IWorkloadEventsPolicyPayload,
  Telemetry,
  IRuntimeDataPayload,
  IRuntimeDataFact,
  IRuntimeImage,
} from './types';
import { state } from '../state';
import { isExcludedNamespace } from '../supervisor/watchers/internal-namespaces';
import { logger } from '../common/logger';

export function constructDepGraph(
  scannedImages: IScanResult[],
  workloadMetadata: IWorkload[],
): IDependencyGraphPayload[] {
  const results = scannedImages.map((scannedImage): IDependencyGraphPayload => {
    // We know that .find() won't return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const kubeWorkload: IWorkload = workloadMetadata.find(
      (meta) => meta.imageName === scannedImage.imageWithTag,
    )!;

    const { cluster, namespace, type, name } = kubeWorkload;

    const imageLocator: IImageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
      imageWithDigest: scannedImage.imageWithDigest,
      cluster,
      namespace,
      type,
      name,
    };

    return {
      imageLocator,
      agentId: config.AGENT_ID,
      dependencyGraph: JSON.stringify(scannedImage.pluginResult),
    };
  });

  return results;
}

export function constructScanResults(
  scannedImages: IScanResult[],
  workloadMetadata: IWorkload[],
  telemetry: Partial<Telemetry>,
): ScanResultsPayload[] {
  return scannedImages.map<ScanResultsPayload>((scannedImage) => {
    // We know that .find() won't return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const kubeWorkload: IWorkload = workloadMetadata.find(
      (meta) => meta.imageName === scannedImage.imageWithTag,
    )!;

    const { cluster, namespace, type, name } = kubeWorkload;

    const imageLocator: IImageLocator = {
      userLocator: config.INTEGRATION_ID,
      imageId: scannedImage.image,
      imageWithDigest: scannedImage.imageWithDigest,
      cluster,
      namespace,
      type,
      name,
    };

    return {
      telemetry,
      imageLocator,
      agentId: config.AGENT_ID,
      scanResults: scannedImage.scanResults,
    };
  });
}

export function constructWorkloadMetadata(
  workload: IWorkload,
): IWorkloadMetadataPayload {
  if (!workload) {
    throw new Error(
      "can't build workload metadata payload for undefined workload",
    );
  }

  const workloadLocator: IWorkloadLocator = {
    userLocator: config.INTEGRATION_ID,
    cluster: workload.cluster,
    namespace: workload.namespace,
    type: workload.type,
    name: workload.name,
  };
  const workloadMetadata: IWorkloadMetadata = {
    labels: workload.labels,
    specLabels: workload.specLabels,
    annotations: workload.annotations,
    specAnnotations: workload.specAnnotations,
    namespaceAnnotations:
      state.watchedNamespaces[workload.namespace]?.metadata?.annotations,
    revision: workload.revision,
    podSpec: workload.podSpec,
  };
  return { workloadLocator, agentId: config.AGENT_ID, workloadMetadata };
}

export function constructDeleteUrlParams(
  localWorkloadLocator: ILocalWorkloadLocator,
): string {
  return `${config.INTEGRATION_ID}/${currentClusterName}/${localWorkloadLocator.namespace}/${localWorkloadLocator.type}/${localWorkloadLocator.name}/${config.AGENT_ID}`;
}

export function constructWorkloadEventsPolicy(
  policy: string,
): IWorkloadEventsPolicyPayload {
  return {
    policy,
    userLocator: config.INTEGRATION_ID,
    cluster: currentClusterName,
    agentId: config.AGENT_ID,
  };
}

const workloadKindMap = {
  deployment: 'Deployment',
  replicaset: 'ReplicaSet',
  statefulset: 'StatefulSet',
  daemonset: 'DaemonSet',
  job: 'Job',
  cronjob: 'CronJob',
  replicationcontroller: 'ReplicationController',
  deploymentconfig: 'DeploymentConfig',
  pod: 'Pod',
  rollout: 'Rollout',
};
export function constructRuntimeData(
  runtimeResults: IRuntimeImage[],
): IRuntimeDataPayload {
  const filteredRuntimeResults = runtimeResults.reduce((acc, runtimeResult) => {
    if (!isExcludedNamespace(runtimeResult.namespace)) {
      const mappedWorkloadKind =
        workloadKindMap[runtimeResult.workloadKind.toLowerCase()];
      if (mappedWorkloadKind) {
        runtimeResult.workloadKind = mappedWorkloadKind;
        acc.push(runtimeResult);
      } else {
        logger.error(
          {
            imageID: runtimeResult.imageID,
            namespace: runtimeResult.namespace,
            workloadName: runtimeResult.workloadName,
            workloadKind: runtimeResult.workloadKind,
          },
          'invalid Sysdig workload kind',
        );
      }
    }
    return acc;
  }, [] as IRuntimeImage[]);

  const dataFact: IRuntimeDataFact = {
    type: 'loadedPackages',
    data: filteredRuntimeResults,
  };

  return {
    identity: {
      type: 'sysdig',
    },
    target: {
      agentId: config.AGENT_ID,
      userLocator: config.INTEGRATION_ID,
      cluster: currentClusterName,
    },
    facts: [dataFact],
  };
}
