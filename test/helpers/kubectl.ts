import { exec } from 'child-process-promise';
import { accessSync, chmodSync, constants, writeFileSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';
import * as sleep from 'sleep-promise';

export async function downloadKubectl(): Promise<void> {
  try {
    accessSync(resolve(process.cwd(), 'kubectl'), constants.R_OK);
  } catch (error) {
    console.log('Downloading kubectl...');

    // eslint-disable-next-line @typescript-eslint/camelcase
    const requestOptions = { follow_max: 2 };
    const k8sRelease = await getLatestStableK8sRelease();
    const osDistro = platform();
    const bodyData = null;
    await needle('get', 'https://storage.googleapis.com/kubernetes-release/release/' +
      `${k8sRelease}/bin/${osDistro}/amd64/kubectl`,
      bodyData,
      requestOptions,
    ).then((response) => {
      writeFileSync('kubectl', response.body);
      chmodSync('kubectl', 0o755); // rwxr-xr-x
    });

    console.log('kubectl downloaded');
  }
}

export async function createNamespace(namespace: string): Promise<void> {
  console.log(`Creating namespace ${namespace}...`);
  await exec(`./kubectl create namespace ${namespace}`);
  console.log(`Created namespace ${namespace}`);
}

export async function deleteNamespace(namespace: string): Promise<void> {
  console.log(`Deleting namespace ${namespace}...`);
  await exec(`./kubectl delete namespace ${namespace} --ignore-not-found`);
  console.log(`Deleted namespace ${namespace}`);
}

export async function createSecret(
  secretName: string,
  namespace: string,
  secrets: { [key: string]: string },
  secretsKeyPrefix = '--from-literal=',
  secretType = 'generic',
): Promise<void> {
  console.log(`Creating secret ${secretName} in namespace ${namespace}...`);
  const secretsAsKubectlArgument = Object.keys(secrets)
    .reduce((prev, key) => `${prev} ${secretsKeyPrefix}${key}='${secrets[key]}'`, '');
  await exec(`./kubectl create secret ${secretType} ${secretName} -n ${namespace} ${secretsAsKubectlArgument}`);
  console.log(`Created secret ${secretName}`);
}

export async function applyK8sYaml(pathToYamlDeployment: string): Promise<void> {
  console.log(`Applying ${pathToYamlDeployment}...`);
  await exec(`./kubectl apply -f ${pathToYamlDeployment}`);
  console.log(`Applied ${pathToYamlDeployment}`);
}

export async function createPodFromImage(name: string, image: string, namespace: string) {
  console.log(`Letting Kubernetes decide how to manage image ${image} with name ${name}`);
  await exec(`./kubectl run ${name} --image=${image} -n ${namespace} -- sleep 999999999`);
  console.log(`Done Letting Kubernetes decide how to manage image ${image} with name ${name}`);
}

export async function patchResourceFinalizers(kind: string, name: string, namespace: string) {
  console.log(`Patching resource finalizers for ${kind} ${name} in namespace ${namespace}...`);
  await exec(`./kubectl patch ${kind} ${name} -p '{"metadata":{"finalizers":[]}}' --type=merge -n ${namespace}`);
  console.log(`Patched resources finalizers for ${kind} ${name}`);
}

export async function deleteResource(kind: string, name: string, namespace: string) {
  console.log(`Deleting ${kind} ${name} in namespace ${namespace}...`);
  await exec(`./kubectl delete ${kind} ${name} -n ${namespace}`);
  console.log(`Deleted ${kind} ${name}`);
}

export async function deleteDeployment(deploymentName: string, namespace: string) {
  console.log(`Deleting deployment ${deploymentName} in namespace ${namespace}...`);
  await exec(`./kubectl delete deployment ${deploymentName} -n ${namespace}`);
  console.log(`Deleted deployment ${deploymentName}`);
}

export async function deletePod(podName: string, namespace: string) {
  console.log(`Deleting pod ${podName} in namespace ${namespace}...`);
  await exec(`./kubectl delete pod ${podName} -n ${namespace}`);
  console.log(`Deleted pod ${podName}`);
}

export async function getDeploymentJson(deploymentName: string, namespace: string): Promise<any> {
  const getDeploymentResult = await exec(`./kubectl get deployment ${deploymentName} -n ${namespace} -o json`);
  return JSON.parse(getDeploymentResult.stdout);
}

export async function getPodNames(namespace: string): Promise<string[]> {
  const commandPrefix = `./kubectl -n ${namespace} get pods`;
  const onlyNames = ' --template \'{{range .items}}{{.metadata.name}}{{"\\n"}}{{end}}\'';
  const podsOutput = await exec(commandPrefix+onlyNames);
  return podsOutput.stdout.split('\n');
}

export async function getPodLogs(podName: string, namespace: string): Promise<any> {
  const logsOutput = await exec(`./kubectl -n ${namespace} logs ${podName}`);
  return logsOutput.stdout;
}

export async function waitForDeployment(name: string, namespace: string): Promise<void> {
  console.log(`Trying to find deployment ${name} in namespace ${namespace}`);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await exec(`./kubectl get deployment.apps/${name} -n ${namespace}`);
    } catch (error) {
      await sleep(1000);
    }
  }
  console.log(`Found deployment ${name} in namespace ${namespace}`);

  console.log(`Begin waiting for deployment ${name} in namespace ${namespace}`);
  await exec(`./kubectl wait --for=condition=available deployment.apps/${name} -n ${namespace} --timeout=60s`);
  console.log(`Deployment ${name} in namespace ${namespace} is available`);
}

export async function waitForServiceAccount(name: string, namespace: string): Promise<void> {
  // TODO: add some timeout
  while (true) {
    try {
      await exec(`./kubectl get serviceaccount ${name} -n ${namespace}`);
      break;
    } catch (err) {
      await sleep(500);
    }
  }
}

async function getLatestStableK8sRelease(): Promise<string> {
  const k8sRelease = await needle('get',
    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
    null,
  ).then((response) => response.body.replace(/[\n\t\r]/g, '').trim());
  console.log(`The latest stable K8s release is ${k8sRelease}`);
  return k8sRelease;
}
