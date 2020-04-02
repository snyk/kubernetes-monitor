import { yamlDeployer } from './yaml';
import { operatorDeployer } from './operator';
import { helmDeployer } from './helm';

export default {
  YAML: yamlDeployer,
  Operator: operatorDeployer,
  Helm: helmDeployer,
};
