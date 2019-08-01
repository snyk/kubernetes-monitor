import { V1ReplicationController } from '@kubernetes/client-node';
import * as uuidv4 from 'uuid/v4';
import { WatchEventType } from '../types';
import { deleteWorkload } from './index';

export async function replicationControllerWatchHandler(
    eventType: string, replicationController: V1ReplicationController) {
  if (eventType !== WatchEventType.Deleted) {
    return;
  }

  const logId = uuidv4().substring(0, 8);

  if (!replicationController.metadata || !replicationController.spec || !replicationController.spec.template ||
      !replicationController.spec.template.metadata || !replicationController.spec.template.spec) {
    // TODO(ivanstanev): possibly log this. It shouldn't happen but we should track it!
    return;
  }

  await deleteWorkload({
    kind: 'ReplicationController',
    objectMeta: replicationController.metadata,
    specMeta: replicationController.spec.template.metadata,
    containers: replicationController.spec.template.spec.containers,
    ownerRefs: replicationController.metadata.ownerReferences,
  }, logId);
}
