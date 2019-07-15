export enum WatchEventType {
  Added = 'ADDED',
  Modified = 'MODIFIED',
  Deleted = 'DELETED',
  Bookmark = 'BOOKMARK',
  Error = 'ERROR',
}

export enum PodPhase {
  // The pod has been accepted by the Kubernetes system, but one or more of the container images has not been created.
  Pending = 'Pending',
  // The pod has been bound to a node, and all of the containers have been created.
  Running = 'Running',
  // All containers in the pod have terminated in success, and will not be restarted.
  Succeeded = 'Succeeded',
  // All containers in the pod have terminated, and at least one container has terminated in failure.
  Failed = 'Failed',
  // For some reason the state of the pod could not be obtained.
  Unknown = 'Unknown',
}
