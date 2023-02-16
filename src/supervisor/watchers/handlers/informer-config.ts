import { ADD, DELETE, UPDATE } from '@kubernetes/client-node';

import { WorkloadKind } from '../../types';
import * as pod from './pod';
import * as service from './service';
import * as ingress from './ingress';
import * as cronJob from './cron-job';
import * as daemonSet from './daemon-set';
import * as deployment from './deployment';
import * as job from './job';
import * as replicaSet from './replica-set';
import * as replicationController from './replication-controller';
import * as statefulSet from './stateful-set';
import * as deploymentConfig from './deployment-config';
import * as rollout from './argo-rollout';
import * as genericCrd from './generic-crd';
import { IWorkloadWatchMetadata } from './types';
import {
  EnterpriseGlooSoloAuthConfigV1ApiDefinition,
  FedEnterpriseGlooSoloFederatedAuthConfigV1ApiDefinition,
  FedGatewaySoloFederatedGatewayV1ApiDefinition,
  FedGatewaySoloFederatedRouteTableV1ApiDefinition,
  FedGatewaySoloFederatedVirtualServiceV1ApiDefinition,
  FedGlooSoloFederatedSettingsV1ApiDefinition,
  FedGlooSoloFederatedUpstreamGroupV1ApiDefinition,
  FedGlooSoloFederatedUpstreamV1ApiDefinition,
  FedRatelimitSoloFederatedRateLimitConfigV1alpha1ApiDefinition,
  FedSoloFailoverSchemeV1ApiDefinition,
  FedSoloGlooInstanceV1ApiDefinition,
  GatewaySoloGatewayV1ApiDefinition,
  GatewaySoloMatchableHttpGatewayV1ApiDefinition,
  GatewaySoloRouteOptionV1ApiDefinition,
  GatewaySoloRouteTableV1ApiDefinition,
  GatewaySoloVirtualHostOptionV1ApiDefinition,
  GatewaySoloVirtualServiceV1ApiDefinition,
  GetambassadorAuthServiceV3alpha1ApiDefinition,
  GetambassadorConsulResolverV3alpha1ApiDefinition,
  GetambassadorDevPortalV3alpha1ApiDefinition,
  GetambassadorHostV3alpha1ApiDefinition,
  GetambassadorKubernetesEndpointResolverV3alpha1ApiDefinition,
  GetambassadorKubernetesServiceResolverV3alpha1ApiDefinition,
  GetambassadorListenerV3alpha1ApiDefinition,
  GetambassadorLogServiceV3alpha1ApiDefinition,
  GetambassadorMappingV3alpha1ApiDefinition,
  GetambassadorModuleV3alpha1ApiDefinition,
  GetambassadorRateLimitServiceV3alpha1ApiDefinition,
  GetambassadorTCPMappingV3alpha1ApiDefinition,
  GetambassadorTLSContextV3alpha1ApiDefinition,
  GetambassadorTracingServiceV3alpha1ApiDefinition,
  GlooSoloProxyV1ApiDefinition,
  GlooSoloSettingsV1ApiDefinition,
  GlooSoloUpstreamGroupV1ApiDefinition,
  GlooSoloUpstreamV1ApiDefinition,
  GraphqlGlooSoloGraphQLSchemaV1alpha1ApiDefinition,
  InstallIstioIstioOperatorV1alpha1ApiDefinition,
  MulticlusterSoloKubernetesClusterV1alpha1ApiDefinition,
  MulticlusterSoloMultiClusterRoleBindingV1alpha1ApiDefinition,
  MulticlusterSoloMultiClusterRoleV1alpha1ApiDefinition,
  NetworkingGkeManagedCertificateV1ApiDefinition,
  NetworkingGkeFrontendConfigV1beta1ApiDefinition,
  NetworkingGkeServiceAttachmentV1beta1ApiDefinition,
  NetworkingGkeServiceNetworkEndpointGroupV1beta1ApiDefinition,
  NetworkingIstioEnvoyFilterV1alpha3ApiDefinition,
  NetworkingIstioWorkloadGroupV1alpha3ApiDefinition,
  NetworkingIstioDestinationRuleV1beta1ApiDefinition,
  NetworkingIstioGatewayV1beta1ApiDefinition,
  NetworkingIstioServiceEntryV1beta1ApiDefinition,
  NetworkingIstioSidecarV1beta1ApiDefinition,
  NetworkingIstioVirtualServiceV1beta1ApiDefinition,
  NetworkingIstioWorkloadEntryV1beta1ApiDefinition,
  RatelimitSoloRateLimitConfigV1alpha1ApiDefinition,
  SecurityIstioAuthorizationPolicyV1beta1ApiDefinition,
  SecurityIstioPeerAuthenticationV1beta1ApiDefinition,
  SecurityIstioRequestAuthenticationV1beta1ApiDefinition,
  TelemetryIstioTelemetryV1alpha1ApiDefinition,
} from './crd-api-definitions';

/**
 * This map is used in combination with the kubernetes-client Informer API
 * to abstract which resources to watch, what their endpoint is, how to grab
 * a list of the resources, and which watch actions to handle (e.g. a newly added resource).
 *
 * The Informer API is just a wrapper around Kubernetes watches that makes sure the watch
 * gets restarted if it dies and it also efficiently tracks changes to the watched workloads
 * by comparing their resourceVersion.
 *
 * The map is keyed by the "WorkloadKind" -- the type of resource we want to watch.
 * Legal verbs for the "handlers" are pulled from '@kubernetes/client-node'. You can
 * set a different handler for every verb.
 * (e.g. ADD-ed workloads are processed differently than DELETE-d ones)
 *
 * The "listFunc" is a callback used by the kubernetes-client to grab the watched resource
 * whenever Kubernetes fires a "workload changed" event and it uses the result to figure out
 * if the workload actually changed (by inspecting the resourceVersion).
 */
export const workloadWatchMetadata: Readonly<IWorkloadWatchMetadata> = {
  [WorkloadKind.Pod]: {
    clusterEndpoint: '/api/v1/pods',
    namespacedEndpoint: '/api/v1/namespaces/{namespace}/pods',
    handlers: {
      [ADD]: pod.podWatchHandler,
      [DELETE]: pod.podDeletedHandler,
      [UPDATE]: pod.podWatchHandler,
    },
    clusterListFactory: () => () => pod.paginatedClusterPodList(),
    namespacedListFactory: (namespace) => () =>
      pod.paginatedNamespacedPodList(namespace),
  },
  [WorkloadKind.ReplicationController]: {
    clusterEndpoint: '/api/v1/replicationcontrollers',
    namespacedEndpoint: '/api/v1/namespaces/{namespace}/replicationcontrollers',
    handlers: {
      [DELETE]: replicationController.replicationControllerWatchHandler,
    },
    clusterListFactory: () => () =>
      replicationController.paginatedClusterReplicationControllerList(),
    namespacedListFactory: (namespace) => () =>
      replicationController.paginatedNamespacedReplicationControllerList(
        namespace,
      ),
  },
  [WorkloadKind.Service]: {
    clusterEndpoint: '/api/v1/services',
    namespacedEndpoint: '/api/v1/namespaces/{namespace}/services',
    handlers: {
      [ADD]: service.serviceWatchHandler,
      [DELETE]: service.serviceDeletedHandler,
      [UPDATE]: service.serviceWatchHandler,
    },
    clusterListFactory: () => () => service.paginatedClusterServiceList(),
    namespacedListFactory: (namespace) => () =>
      service.paginatedNamespacedServiceList(namespace),
  },
  [WorkloadKind.CronJob]: {
    clusterEndpoint: '/apis/batch/v1/cronjobs',
    namespacedEndpoint: '/apis/batch/v1/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJob.cronJobWatchHandler,
    },
    clusterListFactory: () => () => cronJob.paginatedClusterCronJobList(),
    namespacedListFactory: (namespace) => () =>
      cronJob.paginatedNamespacedCronJobList(namespace),
  },
  [WorkloadKind.CronJobV1Beta1]: {
    clusterEndpoint: '/apis/batch/v1beta1/cronjobs',
    namespacedEndpoint: '/apis/batch/v1beta1/namespaces/{namespace}/cronjobs',
    handlers: {
      [DELETE]: cronJob.cronJobWatchHandler,
    },
    clusterListFactory: () => () =>
      cronJob.paginatedClusterCronJobV1Beta1List(),
    namespacedListFactory: (namespace) => () =>
      cronJob.paginatedNamespacedCronJobV1Beta1List(namespace),
  },
  [WorkloadKind.Job]: {
    clusterEndpoint: '/apis/batch/v1/jobs',
    namespacedEndpoint: '/apis/batch/v1/namespaces/{namespace}/jobs',
    handlers: {
      [DELETE]: job.jobWatchHandler,
    },
    clusterListFactory: () => () => job.paginatedClusterJobList(),
    namespacedListFactory: (namespace) => () =>
      job.paginatedNamespacedJobList(namespace),
  },
  [WorkloadKind.DaemonSet]: {
    clusterEndpoint: '/apis/apps/v1/daemonsets',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/daemonsets',
    handlers: {
      [DELETE]: daemonSet.daemonSetWatchHandler,
    },
    clusterListFactory: () => () => daemonSet.paginatedClusterDaemonSetList(),
    namespacedListFactory: (namespace) => () =>
      daemonSet.paginatedNamespacedDaemonSetList(namespace),
  },
  [WorkloadKind.Deployment]: {
    clusterEndpoint: '/apis/apps/v1/deployments',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/deployments',
    handlers: {
      [DELETE]: deployment.deploymentWatchHandler,
    },
    clusterListFactory: () => () => deployment.paginatedClusterDeploymentList(),
    namespacedListFactory: (namespace) => () =>
      deployment.paginatedNamespacedDeploymentList(namespace),
  },
  [WorkloadKind.ReplicaSet]: {
    clusterEndpoint: '/apis/apps/v1/replicasets',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/replicasets',
    handlers: {
      [DELETE]: replicaSet.replicaSetWatchHandler,
    },
    clusterListFactory: () => () => replicaSet.paginatedClusterReplicaSetList(),
    namespacedListFactory: (namespace) => () =>
      replicaSet.paginatedNamespacedReplicaSetList(namespace),
  },
  [WorkloadKind.StatefulSet]: {
    clusterEndpoint: '/apis/apps/v1/statefulsets',
    namespacedEndpoint: '/apis/apps/v1/namespaces/{namespace}/statefulsets',
    handlers: {
      [DELETE]: statefulSet.statefulSetWatchHandler,
    },
    clusterListFactory: () => () =>
      statefulSet.paginatedClusterStatefulSetList(),
    namespacedListFactory: (namespace) => () =>
      statefulSet.paginatedNamespacedStatefulSetList(namespace),
  },
  [WorkloadKind.Ingress]: {
    clusterEndpoint: '/apis/networking.k8s.io/v1/ingresses',
    namespacedEndpoint:
      '/apis/networking.k8s.io/v1/namespaces/{namespace}/ingresses',
    handlers: {
      [ADD]: ingress.ingressWatchHandler,
      [DELETE]: ingress.ingressDeletedHandler,
      [UPDATE]: ingress.ingressWatchHandler,
    },
    clusterListFactory: () => () => ingress.paginatedClusterIngressList(),
    namespacedListFactory: (namespace) => () =>
      ingress.paginatedNamespacedIngressList(namespace),
  },
  [WorkloadKind.DeploymentConfig]: {
    clusterEndpoint: '/apis/apps.openshift.io/v1/deploymentconfigs',
    /** https://docs.openshift.com/container-platform/4.7/rest_api/workloads_apis/deploymentconfig-apps-openshift-io-v1.html */
    namespacedEndpoint:
      '/apis/apps.openshift.io/v1/namespaces/{namespace}/deploymentconfigs',
    handlers: {
      [DELETE]: deploymentConfig.deploymentConfigWatchHandler,
    },
    clusterListFactory: () => () =>
      deploymentConfig.paginatedClusterDeploymentConfigList(),
    namespacedListFactory: (namespace) => () =>
      deploymentConfig.paginatedNamespacedDeploymentConfigList(namespace),
  },
  [WorkloadKind.ArgoRollout]: {
    clusterEndpoint: '/apis/argoproj.io/v1alpha1/rollouts',
    namespacedEndpoint:
      '/apis/argoproj.io/v1alpha1/namespaces/{namespace}/rollouts',
    handlers: {
      [DELETE]: rollout.argoRolloutWatchHandler,
    },
    clusterListFactory: () => () => rollout.paginatedClusterArgoRolloutList(),
    namespacedListFactory: (namespace) => () =>
      rollout.paginatedNamespacedArgoRolloutList(namespace),
  },
  [WorkloadKind.EnterpriseGlooSoloAuthConfigV1]: {
    clusterEndpoint:
      EnterpriseGlooSoloAuthConfigV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      EnterpriseGlooSoloAuthConfigV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        EnterpriseGlooSoloAuthConfigV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        EnterpriseGlooSoloAuthConfigV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedEnterpriseGlooSoloFederatedAuthConfigV1]: {
    clusterEndpoint:
      FedEnterpriseGlooSoloFederatedAuthConfigV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedEnterpriseGlooSoloFederatedAuthConfigV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedEnterpriseGlooSoloFederatedAuthConfigV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedEnterpriseGlooSoloFederatedAuthConfigV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedGatewaySoloFederatedGatewayV1]: {
    clusterEndpoint:
      FedGatewaySoloFederatedGatewayV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedGatewaySoloFederatedGatewayV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedGatewaySoloFederatedGatewayV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedGatewaySoloFederatedGatewayV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedGatewaySoloFederatedRouteTableV1]: {
    clusterEndpoint:
      FedGatewaySoloFederatedRouteTableV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedGatewaySoloFederatedRouteTableV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedGatewaySoloFederatedRouteTableV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedGatewaySoloFederatedRouteTableV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedGatewaySoloFederatedVirtualServiceV1]: {
    clusterEndpoint:
      FedGatewaySoloFederatedVirtualServiceV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedGatewaySoloFederatedVirtualServiceV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedGatewaySoloFederatedVirtualServiceV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedGatewaySoloFederatedVirtualServiceV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedGlooSoloFederatedSettingsV1]: {
    clusterEndpoint:
      FedGlooSoloFederatedSettingsV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedGlooSoloFederatedSettingsV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedGlooSoloFederatedSettingsV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedGlooSoloFederatedSettingsV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedGlooSoloFederatedUpstreamGroupV1]: {
    clusterEndpoint:
      FedGlooSoloFederatedUpstreamGroupV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedGlooSoloFederatedUpstreamGroupV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedGlooSoloFederatedUpstreamGroupV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedGlooSoloFederatedUpstreamGroupV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedGlooSoloFederatedUpstreamV1]: {
    clusterEndpoint:
      FedGlooSoloFederatedUpstreamV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedGlooSoloFederatedUpstreamV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedGlooSoloFederatedUpstreamV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedGlooSoloFederatedUpstreamV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedRatelimitSoloFederatedRateLimitConfigV1alpha1]: {
    clusterEndpoint:
      FedRatelimitSoloFederatedRateLimitConfigV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedRatelimitSoloFederatedRateLimitConfigV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        FedRatelimitSoloFederatedRateLimitConfigV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedRatelimitSoloFederatedRateLimitConfigV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedSoloFailoverSchemeV1]: {
    clusterEndpoint: FedSoloFailoverSchemeV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedSoloFailoverSchemeV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(FedSoloFailoverSchemeV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedSoloFailoverSchemeV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.FedSoloGlooInstanceV1]: {
    clusterEndpoint: FedSoloGlooInstanceV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      FedSoloGlooInstanceV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(FedSoloGlooInstanceV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        FedSoloGlooInstanceV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GatewaySoloGatewayV1]: {
    clusterEndpoint: GatewaySoloGatewayV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GatewaySoloGatewayV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GatewaySoloGatewayV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GatewaySoloGatewayV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GatewaySoloMatchableHttpGatewayV1]: {
    clusterEndpoint:
      GatewaySoloMatchableHttpGatewayV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GatewaySoloMatchableHttpGatewayV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GatewaySoloMatchableHttpGatewayV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GatewaySoloMatchableHttpGatewayV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GatewaySoloRouteOptionV1]: {
    clusterEndpoint: GatewaySoloRouteOptionV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GatewaySoloRouteOptionV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GatewaySoloRouteOptionV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GatewaySoloRouteOptionV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GatewaySoloRouteTableV1]: {
    clusterEndpoint: GatewaySoloRouteTableV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GatewaySoloRouteTableV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GatewaySoloRouteTableV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GatewaySoloRouteTableV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GatewaySoloVirtualHostOptionV1]: {
    clusterEndpoint:
      GatewaySoloVirtualHostOptionV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GatewaySoloVirtualHostOptionV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GatewaySoloVirtualHostOptionV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GatewaySoloVirtualHostOptionV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GatewaySoloVirtualServiceV1]: {
    clusterEndpoint:
      GatewaySoloVirtualServiceV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GatewaySoloVirtualServiceV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GatewaySoloVirtualServiceV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GatewaySoloVirtualServiceV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorAuthServiceV3alpha1]: {
    clusterEndpoint:
      GetambassadorAuthServiceV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorAuthServiceV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorAuthServiceV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorAuthServiceV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorConsulResolverV3alpha1]: {
    clusterEndpoint:
      GetambassadorConsulResolverV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorConsulResolverV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorConsulResolverV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorConsulResolverV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorDevPortalV3alpha1]: {
    clusterEndpoint:
      GetambassadorDevPortalV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorDevPortalV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorDevPortalV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorDevPortalV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorHostV3alpha1]: {
    clusterEndpoint:
      GetambassadorHostV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorHostV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorHostV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorHostV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorKubernetesEndpointResolverV3alpha1]: {
    clusterEndpoint:
      GetambassadorKubernetesEndpointResolverV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorKubernetesEndpointResolverV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorKubernetesEndpointResolverV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorKubernetesEndpointResolverV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorKubernetesServiceResolverV3alpha1]: {
    clusterEndpoint:
      GetambassadorKubernetesServiceResolverV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorKubernetesServiceResolverV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorKubernetesServiceResolverV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorKubernetesServiceResolverV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorListenerV3alpha1]: {
    clusterEndpoint:
      GetambassadorListenerV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorListenerV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorListenerV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorListenerV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorLogServiceV3alpha1]: {
    clusterEndpoint:
      GetambassadorLogServiceV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorLogServiceV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorLogServiceV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorLogServiceV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorMappingV3alpha1]: {
    clusterEndpoint:
      GetambassadorMappingV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorMappingV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorMappingV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorMappingV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorModuleV3alpha1]: {
    clusterEndpoint:
      GetambassadorModuleV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorModuleV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorModuleV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorModuleV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorRateLimitServiceV3alpha1]: {
    clusterEndpoint:
      GetambassadorRateLimitServiceV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorRateLimitServiceV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorRateLimitServiceV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorRateLimitServiceV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorTCPMappingV3alpha1]: {
    clusterEndpoint:
      GetambassadorTCPMappingV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorTCPMappingV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorTCPMappingV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorTCPMappingV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorTLSContextV3alpha1]: {
    clusterEndpoint:
      GetambassadorTLSContextV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorTLSContextV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorTLSContextV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorTLSContextV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GetambassadorTracingServiceV3alpha1]: {
    clusterEndpoint:
      GetambassadorTracingServiceV3alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GetambassadorTracingServiceV3alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GetambassadorTracingServiceV3alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GetambassadorTracingServiceV3alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GlooSoloProxyV1]: {
    clusterEndpoint: GlooSoloProxyV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint: GlooSoloProxyV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GlooSoloProxyV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GlooSoloProxyV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GlooSoloSettingsV1]: {
    clusterEndpoint: GlooSoloSettingsV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint: GlooSoloSettingsV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GlooSoloSettingsV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GlooSoloSettingsV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GlooSoloUpstreamGroupV1]: {
    clusterEndpoint: GlooSoloUpstreamGroupV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GlooSoloUpstreamGroupV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GlooSoloUpstreamGroupV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GlooSoloUpstreamGroupV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GlooSoloUpstreamV1]: {
    clusterEndpoint: GlooSoloUpstreamV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint: GlooSoloUpstreamV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(GlooSoloUpstreamV1ApiDefinition),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GlooSoloUpstreamV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.GraphqlGlooSoloGraphQLSchemaV1alpha1]: {
    clusterEndpoint:
      GraphqlGlooSoloGraphQLSchemaV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      GraphqlGlooSoloGraphQLSchemaV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        GraphqlGlooSoloGraphQLSchemaV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        GraphqlGlooSoloGraphQLSchemaV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.InstallIstioIstioOperatorV1alpha1]: {
    clusterEndpoint:
      InstallIstioIstioOperatorV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      InstallIstioIstioOperatorV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        InstallIstioIstioOperatorV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        InstallIstioIstioOperatorV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.MulticlusterSoloKubernetesClusterV1alpha1]: {
    clusterEndpoint:
      MulticlusterSoloKubernetesClusterV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      MulticlusterSoloKubernetesClusterV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        MulticlusterSoloKubernetesClusterV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        MulticlusterSoloKubernetesClusterV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.MulticlusterSoloMultiClusterRoleBindingV1alpha1]: {
    clusterEndpoint:
      MulticlusterSoloMultiClusterRoleBindingV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      MulticlusterSoloMultiClusterRoleBindingV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        MulticlusterSoloMultiClusterRoleBindingV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        MulticlusterSoloMultiClusterRoleBindingV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.MulticlusterSoloMultiClusterRoleV1alpha1]: {
    clusterEndpoint:
      MulticlusterSoloMultiClusterRoleV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      MulticlusterSoloMultiClusterRoleV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        MulticlusterSoloMultiClusterRoleV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        MulticlusterSoloMultiClusterRoleV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingGkeManagedCertificateV1]: {
    clusterEndpoint:
      NetworkingGkeManagedCertificateV1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingGkeManagedCertificateV1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingGkeManagedCertificateV1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingGkeManagedCertificateV1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingGkeFrontendConfigV1beta1]: {
    clusterEndpoint:
      NetworkingGkeFrontendConfigV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingGkeFrontendConfigV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingGkeFrontendConfigV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingGkeFrontendConfigV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingGkeServiceAttachmentV1beta1]: {
    clusterEndpoint:
      NetworkingGkeServiceAttachmentV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingGkeServiceAttachmentV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingGkeServiceAttachmentV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingGkeServiceAttachmentV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingGkeServiceNetworkEndpointGroupV1beta1]: {
    clusterEndpoint:
      NetworkingGkeServiceNetworkEndpointGroupV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingGkeServiceNetworkEndpointGroupV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingGkeServiceNetworkEndpointGroupV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingGkeServiceNetworkEndpointGroupV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioEnvoyFilterV1alpha3]: {
    clusterEndpoint:
      NetworkingIstioEnvoyFilterV1alpha3ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioEnvoyFilterV1alpha3ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioEnvoyFilterV1alpha3ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioEnvoyFilterV1alpha3ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioWorkloadGroupV1alpha3]: {
    clusterEndpoint:
      NetworkingIstioWorkloadGroupV1alpha3ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioWorkloadGroupV1alpha3ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioWorkloadGroupV1alpha3ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioWorkloadGroupV1alpha3ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioDestinationRuleV1beta1]: {
    clusterEndpoint:
      NetworkingIstioDestinationRuleV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioDestinationRuleV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioDestinationRuleV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioDestinationRuleV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioGatewayV1beta1]: {
    clusterEndpoint:
      NetworkingIstioGatewayV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioGatewayV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioGatewayV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioGatewayV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioServiceEntryV1beta1]: {
    clusterEndpoint:
      NetworkingIstioServiceEntryV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioServiceEntryV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioServiceEntryV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioServiceEntryV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioSidecarV1beta1]: {
    clusterEndpoint:
      NetworkingIstioSidecarV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioSidecarV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioSidecarV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioSidecarV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioVirtualServiceV1beta1]: {
    clusterEndpoint:
      NetworkingIstioVirtualServiceV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioVirtualServiceV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioVirtualServiceV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioVirtualServiceV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.NetworkingIstioWorkloadEntryV1beta1]: {
    clusterEndpoint:
      NetworkingIstioWorkloadEntryV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      NetworkingIstioWorkloadEntryV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        NetworkingIstioWorkloadEntryV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        NetworkingIstioWorkloadEntryV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.RatelimitSoloRateLimitConfigV1alpha1]: {
    clusterEndpoint:
      RatelimitSoloRateLimitConfigV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      RatelimitSoloRateLimitConfigV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        RatelimitSoloRateLimitConfigV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        RatelimitSoloRateLimitConfigV1alpha1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.SecurityIstioAuthorizationPolicyV1beta1]: {
    clusterEndpoint:
      SecurityIstioAuthorizationPolicyV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      SecurityIstioAuthorizationPolicyV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        SecurityIstioAuthorizationPolicyV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        SecurityIstioAuthorizationPolicyV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.SecurityIstioPeerAuthenticationV1beta1]: {
    clusterEndpoint:
      SecurityIstioPeerAuthenticationV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      SecurityIstioPeerAuthenticationV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        SecurityIstioPeerAuthenticationV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        SecurityIstioPeerAuthenticationV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.SecurityIstioRequestAuthenticationV1beta1]: {
    clusterEndpoint:
      SecurityIstioRequestAuthenticationV1beta1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      SecurityIstioRequestAuthenticationV1beta1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        SecurityIstioRequestAuthenticationV1beta1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        SecurityIstioRequestAuthenticationV1beta1ApiDefinition,
        namespace,
      ),
  },
  [WorkloadKind.TelemetryIstioTelemetryV1alpha1]: {
    clusterEndpoint:
      TelemetryIstioTelemetryV1alpha1ApiDefinition.getClusterEndpoint(),
    namespacedEndpoint:
      TelemetryIstioTelemetryV1alpha1ApiDefinition.getNamespacedEndpoint(),
    handlers: {
      [ADD]: genericCrd.crdWatchHandler,
      [UPDATE]: genericCrd.crdWatchHandler,
      [DELETE]: genericCrd.crdDeleteHandler,
    },
    clusterListFactory: () => () =>
      genericCrd.paginatedClusterCrdList(
        TelemetryIstioTelemetryV1alpha1ApiDefinition,
      ),
    namespacedListFactory: (namespace) => () =>
      genericCrd.paginatedNamespacedCrdList(
        TelemetryIstioTelemetryV1alpha1ApiDefinition,
        namespace,
      ),
  },
};
