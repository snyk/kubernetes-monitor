import { IncomingMessage } from 'http';
import {
  AppsV1Api,
  BatchV1Api,
  BatchV1beta1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  NetworkingV1Api,
  V1Namespace,
  V1ObjectMeta,
  V1OwnerReference,
  V1PodSpec,
} from '@kubernetes/client-node';

export enum WorkloadKind {
  Deployment = 'Deployment',
  ReplicaSet = 'ReplicaSet',
  StatefulSet = 'StatefulSet',
  DaemonSet = 'DaemonSet',
  Job = 'Job',
  /** Available since Kubernetes 1.20. */
  CronJob = 'CronJob',
  /** @deprecated Will be removed in Kubernetes 1.25. */
  CronJobV1Beta1 = 'CronJobV1Beta1',
  ReplicationController = 'ReplicationController',
  Pod = 'Pod',
  Service = 'Service',
  Ingress = 'Ingress',
  DeploymentConfig = 'DeploymentConfig',
  ArgoRollout = 'Rollout',
  EnterpriseGlooSoloAuthConfigV1 = 'AuthConfig',
  FedEnterpriseGlooSoloFederatedAuthConfigV1 = 'FederatedAuthConfig',
  FedGatewaySoloFederatedGatewayV1 = 'FederatedGateway',
  FedGatewaySoloFederatedRouteTableV1 = 'FederatedRouteTable',
  FedGatewaySoloFederatedVirtualServiceV1 = 'FederatedVirtualService',
  FedGlooSoloFederatedSettingsV1 = 'FederatedSettings',
  FedGlooSoloFederatedUpstreamGroupV1 = 'FederatedUpstreamGroup',
  FedGlooSoloFederatedUpstreamV1 = 'FederatedUpstream',
  FedRatelimitSoloFederatedRateLimitConfigV1alpha1 = 'FederatedRateLimitConfig',
  FedSoloFailoverSchemeV1 = 'FailoverScheme',
  FedSoloGlooInstanceV1 = 'GlooInstance',
  GatewaySoloGatewayV1 = 'Gateway',
  GatewaySoloMatchableHttpGatewayV1 = 'MatchableHttpGateway',
  GatewaySoloRouteOptionV1 = 'RouteOption',
  GatewaySoloRouteTableV1 = 'RouteTable',
  GatewaySoloVirtualHostOptionV1 = 'VirtualHostOption',
  GatewaySoloVirtualServiceV1 = 'VirtualService',
  GetambassadorAuthServiceV3alpha1 = 'AuthService',
  GetambassadorConsulResolverV3alpha1 = 'ConsulResolver',
  GetambassadorDevPortalV3alpha1 = 'DevPortal',
  GetambassadorHostV3alpha1 = 'Host',
  GetambassadorKubernetesEndpointResolverV3alpha1 = 'KubernetesEndpointResolver',
  GetambassadorKubernetesServiceResolverV3alpha1 = 'KubernetesServiceResolver',
  GetambassadorListenerV3alpha1 = 'Listener',
  GetambassadorLogServiceV3alpha1 = 'LogService',
  GetambassadorMappingV3alpha1 = 'Mapping',
  GetambassadorModuleV3alpha1 = 'Module',
  GetambassadorRateLimitServiceV3alpha1 = 'RateLimitService',
  GetambassadorTCPMappingV3alpha1 = 'TCPMapping',
  GetambassadorTLSContextV3alpha1 = 'TLSContext',
  GetambassadorTracingServiceV3alpha1 = 'TracingService',
  GlooSoloProxyV1 = 'Proxy',
  GlooSoloSettingsV1 = 'Settings',
  GlooSoloUpstreamGroupV1 = 'UpstreamGroup',
  GlooSoloUpstreamV1 = 'Upstream',
  GraphqlGlooSoloGraphQLSchemaV1alpha1 = 'GraphQLSchema',
  InstallIstioIstioOperatorV1alpha1 = 'IstioOperator',
  MulticlusterSoloKubernetesClusterV1alpha1 = 'KubernetesCluster',
  MulticlusterSoloMultiClusterRoleBindingV1alpha1 = 'MultiClusterRoleBinding',
  MulticlusterSoloMultiClusterRoleV1alpha1 = 'MultiClusterRole',
  NetworkingGkeManagedCertificateV1 = 'ManagedCertificate',
  NetworkingGkeFrontendConfigV1beta1 = 'FrontendConfig',
  NetworkingGkeServiceAttachmentV1beta1 = 'ServiceAttachment',
  NetworkingGkeServiceNetworkEndpointGroupV1beta1 = 'ServiceNetworkEndpointGroup',
  NetworkingIstioEnvoyFilterV1alpha3 = 'EnvoyFilter',
  NetworkingIstioWorkloadGroupV1alpha3 = 'WorkloadGroup',
  NetworkingIstioDestinationRuleV1beta1 = 'DestinationRule',
  NetworkingIstioGatewayV1beta1 = 'Gateway',
  NetworkingIstioServiceEntryV1beta1 = 'ServiceEntry',
  NetworkingIstioSidecarV1beta1 = 'Sidecar',
  NetworkingIstioVirtualServiceV1beta1 = 'VirtualService',
  NetworkingIstioWorkloadEntryV1beta1 = 'WorkloadEntry',
  RatelimitSoloRateLimitConfigV1alpha1 = 'RateLimitConfig',
  SecurityIstioAuthorizationPolicyV1beta1 = 'AuthorizationPolicy',
  SecurityIstioPeerAuthenticationV1beta1 = 'PeerAuthentication',
  SecurityIstioRequestAuthenticationV1beta1 = 'RequestAuthentication',
  TelemetryIstioTelemetryV1alpha1 = 'Telemetry',
}

export interface IRequestError {
  code?: string;
  response?: IncomingMessage;
}

export interface IKubeObjectMetadata {
  kind: string;
  objectMeta: V1ObjectMeta;
  specMeta: V1ObjectMeta;
  podSpec?: V1PodSpec;
  ownerRefs: V1OwnerReference[] | undefined;
  revision?: number;
}

export type IKubeObjectMetadataWithoutPodSpec = Omit<
  IKubeObjectMetadata,
  'podSpec'
>;

export interface IK8sClients {
  readonly appsClient: AppsV1Api;
  readonly coreClient: CoreV1Api;
  readonly batchClient: BatchV1Api;
  readonly batchUnstableClient: BatchV1beta1Api;
  readonly networkClient: NetworkingV1Api;
  readonly customObjectsClient: CustomObjectsApi;
}

export class K8sClients implements IK8sClients {
  public readonly appsClient: AppsV1Api;
  public readonly coreClient: CoreV1Api;
  public readonly batchClient: BatchV1Api;
  public readonly batchUnstableClient: BatchV1beta1Api;
  public readonly networkClient: NetworkingV1Api;
  /** This client is used to access Custom Resources in the cluster, e.g. DeploymentConfig on OpenShift. */
  public readonly customObjectsClient: CustomObjectsApi;

  constructor(config: KubeConfig) {
    this.appsClient = config.makeApiClient(AppsV1Api);
    this.coreClient = config.makeApiClient(CoreV1Api);
    this.batchClient = config.makeApiClient(BatchV1Api);
    this.batchUnstableClient = config.makeApiClient(BatchV1beta1Api);
    this.networkClient = config.makeApiClient(NetworkingV1Api);
    this.customObjectsClient = config.makeApiClient(CustomObjectsApi);
  }
}

export interface NamespaceResponse {
  response: IncomingMessage;
  body: V1Namespace;
}
