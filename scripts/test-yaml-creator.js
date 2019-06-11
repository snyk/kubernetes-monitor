const fs = require('fs');
const YAML = require('yaml');

const file = fs.readFileSync('./egg-deployment.yaml', 'utf8');
const parsedYAML = YAML.parse(file);
parsedYAML.spec.template.spec.containers[0].image = 'snyk-k8s-monitor:test';
parsedYAML.spec.template.spec.containers[0].imagePullPolicy = 'Never';
fs.writeFileSync('egg-test-deployment.yaml', YAML.stringify(parsedYAML));
