import { DeploymentType } from './types';
import { yamlDeployer } from './yaml';

export default {
  [DeploymentType.YAML]: yamlDeployer,
};
