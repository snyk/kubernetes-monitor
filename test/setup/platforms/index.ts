import * as kind from './kind';
import * as eks from './eks';

export default {
  kind: {create: kind.createCluster, delete: kind.deleteCluster, config: kind.exportKubeConfig},
  eks: {create: eks.createCluster, delete: eks.deleteCluster, config: eks.exportKubeConfig},
}
