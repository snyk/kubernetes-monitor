import * as yaml from './yaml';

export enum DeploymentType {
  YAML,
  Helm,
  Operator,
}

interface IDeployer {
  deploy: (
    integrationId: string,
    imageOpts: {
      imageNameAndTag: string;
      imagePullPolicy: string;
    }
  ) => Promise<void>;
}

const yamlDeployer: IDeployer = {
  deploy: yaml.deployKubernetesMonitor
};

export default {
  [DeploymentType.YAML]: yamlDeployer,
};
