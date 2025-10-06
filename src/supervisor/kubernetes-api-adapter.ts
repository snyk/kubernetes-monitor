/**
 * Adapter layer for @kubernetes/client-node v1.0.0 API compatibility
 *
 * This adapter provides backward compatibility with v0.2.3 API signatures by:
 * 1. Converting individual parameters to object parameters (v1.0.0 uses ObjectParamAPI)
 * 2. Calling *WithHttpInfo methods to get full HTTP metadata
 * 3. Transforming HttpInfo<T> responses to the old { response, body } format
 *
 * This allows the rest of the codebase to remain unchanged.
 */

import {
  KubeConfig,
  CoreV1Api,
  AppsV1Api,
  BatchV1Api,
  CustomObjectsApi,
  HttpInfo,
  V1Namespace,
  V1NamespaceList,
  V1PodList,
  V1PodTemplate,
  V1ReplicationController,
  V1ReplicationControllerList,
  V1Deployment,
  V1DeploymentList,
  V1ReplicaSet,
  V1ReplicaSetList,
  V1StatefulSet,
  V1StatefulSetList,
  V1DaemonSet,
  V1DaemonSetList,
  V1Job,
  V1JobList,
  V1CronJob,
  V1CronJobList,
} from '@kubernetes/client-node';
import { IncomingMessage } from 'http';

/**
 * Helper function to convert HttpInfo<T> to the old { response, body } format
 *
 * The v1.0.0 API returns HttpInfo which contains:
 * - httpStatusCode: number
 * - headers: Record<string, string>
 * - body: ResponseBody (not directly useful)
 * - data: T (the actual response data)
 *
 * We need to create a mock IncomingMessage with the essential properties
 * that the existing error handling and retry logic depends on.
 */
function adaptHttpInfo<T>(httpInfo: HttpInfo<T>): {
  response: IncomingMessage;
  body: T;
} {
  /* Create a mock IncomingMessage with the properties our code actually uses
  risk - we lose details by constructing our own from the new response of the api signatures 
  IncomingMesssage was used before and has more fields available (httpVersion, complete, connection, socket, etc)
  that we now do not have access to. However, currently we only use statusCode, headers and can construct our own statusMessage based on statusCode
*/
  const mockResponse = {
    statusCode: httpInfo.httpStatusCode,
    headers: httpInfo.headers,
    // status messages is mostly used for error logs -- we lose details by constructing our own
    statusMessage:
      httpInfo.httpStatusCode >= 200 && httpInfo.httpStatusCode < 300
        ? 'OK'
        : 'Error',
  } as IncomingMessage;

  return {
    response: mockResponse,
    body: httpInfo.data,
  };
}

/**
 * Adapted CoreV1Api client
 *
 * Wraps the v1.0.0 CoreV1Api and provides v0.2.3-compatible method signatures
 */
export class AdaptedCoreV1Api {
  private api: CoreV1Api;

  constructor(config: KubeConfig) {
    this.api = config.makeApiClient(CoreV1Api);
  }

  /**
   * Read a single namespace
   */
  async readNamespace(
    name: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1Namespace }> {
    const httpInfo = await this.api.readNamespaceWithHttpInfo({
      name,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all namespaces
   */
  async listNamespace(
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1NamespaceList }> {
    const httpInfo = await this.api.listNamespaceWithHttpInfo({
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List pods in a specific namespace
   */
  async listNamespacedPod(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1PodList }> {
    const httpInfo = await this.api.listNamespacedPodWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all pods across all namespaces
   */
  async listPodForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1PodList }> {
    const httpInfo = await this.api.listPodForAllNamespacesWithHttpInfo({
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      pretty,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * Read a pod template in a namespace
   */
  async readNamespacedPodTemplate(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1PodTemplate }> {
    const httpInfo = await this.api.readNamespacedPodTemplateWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List replication controllers in a namespace
   */
  async listNamespacedReplicationController(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1ReplicationControllerList }> {
    const httpInfo =
      await this.api.listNamespacedReplicationControllerWithHttpInfo({
        namespace,
        pretty,
        allowWatchBookmarks,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
        resourceVersion,
        resourceVersionMatch,
        sendInitialEvents,
        timeoutSeconds,
        watch,
      });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all replication controllers across all namespaces
   */
  async listReplicationControllerForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1ReplicationControllerList }> {
    const httpInfo =
      await this.api.listReplicationControllerForAllNamespacesWithHttpInfo({
        allowWatchBookmarks,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
        pretty,
        resourceVersion,
        resourceVersionMatch,
        sendInitialEvents,
        timeoutSeconds,
        watch,
      });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * Read a single replication controller
   */
  async readNamespacedReplicationController(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1ReplicationController }> {
    const httpInfo =
      await this.api.readNamespacedReplicationControllerWithHttpInfo({
        name,
        namespace,
        pretty,
      });
    return adaptHttpInfo(httpInfo);
  }
}

/**
 * Adapted AppsV1Api client
 *
 * Wraps the v1.0.0 AppsV1Api and provides v0.2.3-compatible method signatures
 */
export class AdaptedAppsV1Api {
  private api: AppsV1Api;

  constructor(config: KubeConfig) {
    this.api = config.makeApiClient(AppsV1Api);
  }

  /**
   * Read a single deployment
   */
  async readNamespacedDeployment(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1Deployment }> {
    const httpInfo = await this.api.readNamespacedDeploymentWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List deployments in a namespace
   */
  async listNamespacedDeployment(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1DeploymentList }> {
    const httpInfo = await this.api.listNamespacedDeploymentWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all deployments across all namespaces
   */
  async listDeploymentForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1DeploymentList }> {
    const httpInfo = await this.api.listDeploymentForAllNamespacesWithHttpInfo({
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      pretty,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * Read a single replica set
   */
  async readNamespacedReplicaSet(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1ReplicaSet }> {
    const httpInfo = await this.api.readNamespacedReplicaSetWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List replica sets in a namespace
   */
  async listNamespacedReplicaSet(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1ReplicaSetList }> {
    const httpInfo = await this.api.listNamespacedReplicaSetWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all replica sets across all namespaces
   */
  async listReplicaSetForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1ReplicaSetList }> {
    const httpInfo = await this.api.listReplicaSetForAllNamespacesWithHttpInfo({
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      pretty,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * Read a single stateful set
   */
  async readNamespacedStatefulSet(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1StatefulSet }> {
    const httpInfo = await this.api.readNamespacedStatefulSetWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List stateful sets in a namespace
   */
  async listNamespacedStatefulSet(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1StatefulSetList }> {
    const httpInfo = await this.api.listNamespacedStatefulSetWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all stateful sets across all namespaces
   */
  async listStatefulSetForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1StatefulSetList }> {
    const httpInfo = await this.api.listStatefulSetForAllNamespacesWithHttpInfo(
      {
        allowWatchBookmarks,
        _continue,
        fieldSelector,
        labelSelector,
        limit,
        pretty,
        resourceVersion,
        resourceVersionMatch,
        sendInitialEvents,
        timeoutSeconds,
        watch,
      },
    );
    return adaptHttpInfo(httpInfo);
  }

  /**
   * Read a single daemon set
   */
  async readNamespacedDaemonSet(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1DaemonSet }> {
    const httpInfo = await this.api.readNamespacedDaemonSetWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List daemon sets in a namespace
   */
  async listNamespacedDaemonSet(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1DaemonSetList }> {
    const httpInfo = await this.api.listNamespacedDaemonSetWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all daemon sets across all namespaces
   */
  async listDaemonSetForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1DaemonSetList }> {
    const httpInfo = await this.api.listDaemonSetForAllNamespacesWithHttpInfo({
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      pretty,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }
}

/**
 * Adapted BatchV1Api client
 *
 * Wraps the v1.0.0 BatchV1Api and provides v0.2.3-compatible method signatures
 */
export class AdaptedBatchV1Api {
  private api: BatchV1Api;

  constructor(config: KubeConfig) {
    this.api = config.makeApiClient(BatchV1Api);
  }

  /**
   * Read a single job
   */
  async readNamespacedJob(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1Job }> {
    const httpInfo = await this.api.readNamespacedJobWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List jobs in a namespace
   */
  async listNamespacedJob(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1JobList }> {
    const httpInfo = await this.api.listNamespacedJobWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all jobs across all namespaces
   */
  async listJobForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1JobList }> {
    const httpInfo = await this.api.listJobForAllNamespacesWithHttpInfo({
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      pretty,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * Read a single cron job
   */
  async readNamespacedCronJob(
    name: string,
    namespace: string,
    pretty?: string,
  ): Promise<{ response: IncomingMessage; body: V1CronJob }> {
    const httpInfo = await this.api.readNamespacedCronJobWithHttpInfo({
      name,
      namespace,
      pretty,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List cron jobs in a namespace
   */
  async listNamespacedCronJob(
    namespace: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1CronJobList }> {
    const httpInfo = await this.api.listNamespacedCronJobWithHttpInfo({
      namespace,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List all cron jobs across all namespaces
   */
  async listCronJobForAllNamespaces(
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    pretty?: string,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    sendInitialEvents?: boolean,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: V1CronJobList }> {
    const httpInfo = await this.api.listCronJobForAllNamespacesWithHttpInfo({
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      pretty,
      resourceVersion,
      resourceVersionMatch,
      sendInitialEvents,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }
}

/**
 * Adapted CustomObjectsApi client
 *
 * Wraps the v1.0.0 CustomObjectsApi and provides v0.2.3-compatible method signatures
 *
 * Note: The CustomObjectsApi methods return generic 'object' types in v1.0.0,
 * similar to v0.2.3, so the type casting behavior remains the same.
 */
export class AdaptedCustomObjectsApi {
  private api: CustomObjectsApi;

  constructor(config: KubeConfig) {
    this.api = config.makeApiClient(CustomObjectsApi);
  }

  /**
   * Get a single namespaced custom object
   */
  async getNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string,
  ): Promise<{ response: IncomingMessage; body: object }> {
    const httpInfo = await this.api.getNamespacedCustomObjectWithHttpInfo({
      group,
      version,
      namespace,
      plural,
      name,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List namespaced custom objects
   *
   * Note: CustomObjectsApi does not support sendInitialEvents parameter
   */
  async listNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: object }> {
    const httpInfo = await this.api.listNamespacedCustomObjectWithHttpInfo({
      group,
      version,
      namespace,
      plural,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }

  /**
   * List cluster-scoped custom objects
   *
   * Note: CustomObjectsApi does not support sendInitialEvents parameter
   */
  async listClusterCustomObject(
    group: string,
    version: string,
    plural: string,
    pretty?: string,
    allowWatchBookmarks?: boolean,
    _continue?: string,
    fieldSelector?: string,
    labelSelector?: string,
    limit?: number,
    resourceVersion?: string,
    resourceVersionMatch?: string,
    timeoutSeconds?: number,
    watch?: boolean,
  ): Promise<{ response: IncomingMessage; body: object }> {
    const httpInfo = await this.api.listClusterCustomObjectWithHttpInfo({
      group,
      version,
      plural,
      pretty,
      allowWatchBookmarks,
      _continue,
      fieldSelector,
      labelSelector,
      limit,
      resourceVersion,
      resourceVersionMatch,
      timeoutSeconds,
      watch,
    });
    return adaptHttpInfo(httpInfo);
  }
}
