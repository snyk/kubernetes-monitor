import logger = require('../common/logger');
import {
  AppsV1Api,
  BatchV1Api,
  BatchV1beta1Api,
  CoreV1Api,
  KubeConfig,
  V1ObjectMeta,
  V1OwnerReference,
  V1PodSpec,
  VersionApi,
  VersionInfo
} from '@kubernetes/client-node';

export enum WorkloadKind {
  Deployment = 'Deployment',
  ReplicaSet = 'ReplicaSet',
  StatefulSet = 'StatefulSet',
  DaemonSet = 'DaemonSet',
  Job = 'Job',
  CronJob = 'CronJob',
  ReplicationController = 'ReplicationController',
  Pod = 'Pod',
}

/**
 * https://github.com/containers/skopeo
 */
export enum SkopeoRepositoryType {
  DockerArchive = 'docker-archive',
  OciArchive = 'oci',
  ImageRegistry = 'docker',
  Directory = 'dir', // Note, skopeo marks this as a non-standard format
}

export enum StaticAnalysisImageType {
  DockerArchive = 'docker-archive',
}

export interface IStaticAnalysisOptions {
  imagePath: string;
  imageType: StaticAnalysisImageType;
  tmpDirPath: string;
}

export interface KubeObjectMetadata {
  kind: string;
  objectMeta: V1ObjectMeta;
  specMeta: V1ObjectMeta;
  podSpec: V1PodSpec;
  ownerRefs: V1OwnerReference[] | undefined;
  revision?: number;
}

export interface IK8sClients {
  readonly appsClient: AppsV1Api;
  readonly coreClient: CoreV1Api;
  readonly batchClient: BatchV1Api;
  readonly batchUnstableClient: BatchV1beta1Api;
  readonly versionClient: VersionApi;
  getK8sClientVersion(): Promise<string | undefined>;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: AppsV1Api;
  public readonly coreClient: CoreV1Api;
  public readonly batchClient: BatchV1Api;
  // TODO: Keep an eye on this! We need v1beta1 API for CronJobs.
  // https://kubernetes.io/docs/concepts/overview/kubernetes-api/#api-versioning
  // CronJobs will appear in v2 API, but for now there' only v2alpha1, so it's a bad idea to use it.
  public readonly batchUnstableClient: BatchV1beta1Api;
  public readonly versionClient: VersionApi;

  constructor(config: KubeConfig) {
    this.appsClient = config.makeApiClient(AppsV1Api);
    this.coreClient = config.makeApiClient(CoreV1Api);
    this.batchClient = config.makeApiClient(BatchV1Api);
    this.batchUnstableClient = config.makeApiClient(BatchV1beta1Api);
    this.versionClient = config.makeApiClient(VersionApi);
  }

  public async getK8sClientVersion(): Promise<string | undefined> {
    try {
      const result = await this.versionClient.getCode();
      const versionInfo: VersionInfo = result.body;
      return versionInfo.gitVersion;
    } catch (error) {
      logger.warn({error}, 'failed to get kubernetes api version');
      return;
    }
  }
}
