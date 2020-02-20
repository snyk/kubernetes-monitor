import * as yaml from './yaml';
import { DeploymentType } from './types';

interface IDeployer {
  deploy: (
    integrationId: string,
    imageOpts: {
      imageNameAndTag: string;
      imagePullPolicy: string;
    },
  ) => Promise<void>;
}

const yamlDeployer: IDeployer = {
  deploy: yaml.deployKubernetesMonitor,
};

export default {
  [DeploymentType.YAML]: yamlDeployer,
};
