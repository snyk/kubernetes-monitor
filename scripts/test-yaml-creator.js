const fs = require('fs');
const YAML = require('yaml');

const file = fs.readFileSync('./snyk-monitor-deployment.yaml', 'utf8');
const parsedYAML = YAML.parse(file);
parsedYAML.spec.template.spec.containers[0].image = 'snyk-k8s-monitor:test';
parsedYAML.spec.template.spec.containers[0].imagePullPolicy = 'Never';
fs.writeFileSync('snyk-monitor-test-deployment.yaml', YAML.stringify(parsedYAML));
