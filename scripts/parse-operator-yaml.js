const fs = require("fs");
const yaml = require('js-yaml');

let operatorName = "snyk-operator";
let imageTag = "0.0.0";
let operatorImageName = "snyk/operator";

if (process.argv[2]) {
  operatorName = process.argv[2];
}

if (process.argv[3]) {
  imageTag = process.argv[3];
}

if (process.argv[4]) {
  operatorImageName = process.argv[4];
}

console.log('operatorName: ', operatorName);
console.log('imageTag: ', imageTag);
console.log('operatorImageName: ', operatorImageName);

const operatorPath = `./${operatorName}/deploy/olm-catalog/${operatorName}`;
const operatorBundlePath = `${operatorPath}/${imageTag}`;
const operatorCSVPath = `${operatorBundlePath}/${operatorName}.v${imageTag}.clusterserviceversion.yaml`;
const operatorCRDPath = `${operatorBundlePath}/charts.helm.k8s.io_snykmonitors_crd.yaml`;
const bundleTemplatePath = `${operatorName}/bundle-templates`;
const iconImagePath = `${bundleTemplatePath}/icon-image.txt`;
const descriptionPath = `${bundleTemplatePath}/description.txt`;

// Update CSV static fields
try {
  console.log("Updating CSV file...");
  const yamlDoc = yaml.safeLoad(fs.readFileSync(operatorCSVPath, 'utf8'));
  console.log(yamlDoc);

  // Update Metadata section
  yamlDoc.metadata.annotations.categories = "Developer Tools, Security"
  yamlDoc.metadata.annotations.description = "Operator to monitor Kubernetes clusters' security"
  yamlDoc.metadata.name = `${operatorName}.v${imageTag}`

  // Update spec section
  yamlDoc.spec.maintainers = [{ name: "Snyk Ltd.", email: "support@snyk.io" }];
  yamlDoc.spec.provider = { name: "Snyk Ltd." };
  yamlDoc.spec.links= [
    { name: "Website", url: "https://snyk.io" },
    { name: "Documentation", url: "https://support.snyk.io/hc/en-us/articles/360003916138-Kubernetes-integration-overview" }
  ];
  const iconImage = fs.readFileSync(iconImagePath, 'utf8');
  yamlDoc.spec.icon = [{ base64data: iconImage, mediatype: "image/png" }];
  const description = fs.readFileSync(descriptionPath, 'utf8');
  yamlDoc.spec.description = description;
  yamlDoc.spec.install.spec.deployments[0].spec.template.spec.containers[0].image = `${operatorImageName}:${imageTag}`;
  yamlDoc.spec.customresourcedefinitions = {
    owned: [
      {
        name: "snykmonitors.charts.helm.k8s.io",
        displayName: "SnykMonitor",
        kind: "SnykMonitor",
        version: imageTag,
        description: "It's a Snyk monitor to secure your app",
      }
    ],
    required: []
  }
  console.log(yamlDoc);
  fs.writeFileSync(operatorCSVPath, yaml.safeDump(yamlDoc), 'utf8');
  console.log("CSV file updated");
} catch (e) {
  console.log(e);
}

// Update CRD static fields
try {
  console.log("Updating CRD file...");
  const yamlDoc = yaml.safeLoad(fs.readFileSync(operatorCRDPath, 'utf8'));
  console.log(yamlDoc)

  yamlDoc.spec.versions[0].name = imageTag;

  console.log(yamlDoc);
  fs.writeFileSync(operatorCRDPath, yaml.safeDump(yamlDoc), 'utf8');
  console.log("CRD file updated");
} catch (e) {
  console.log(e);
}
