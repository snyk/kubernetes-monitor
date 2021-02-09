import { execWrapper as exec } from './exec';
import { chmodSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';
import * as needle from 'needle';
import * as sleep from 'sleep-promise';

/**
 * @param version For example: "v1.18.0"
 */
export async function downloadKubectl(version: string): Promise<void> {
  const kubectlPath = resolve(process.cwd(), 'kubectl');
  if (existsSync(kubectlPath)) {
    if (version === 'latest') {
      return;
    }

    // Always start clean when requesting a specific version.
    unlinkSync(kubectlPath);
  }

  console.log(`Downloading kubectl ${version}...`);

  // eslint-disable-next-line @typescript-eslint/camelcase
  const requestOptions = { follow_max: 2 };
  const k8sRelease = version === 'latest' ? await getLatestStableK8sRelease() : version;
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

export async function createConfigMap(
  configMapName: string,
  namespace: string,
  filePath: string
): Promise<void> {
  console.log(`Creating config map ${configMapName} in namespace ${namespace}...`);
  await exec(`./kubectl create configmap ${configMapName} -n ${namespace} --from-file=${filePath}`);
  console.log(`Created config map ${configMapName}`);
}

export async function applyK8sYaml(pathToYamlDeployment: string, namespace?: string): Promise<void> {
  if (namespace) {
    console.log(`Applying ${pathToYamlDeployment} to namespace ${namespace}...`);
    await exec(`./kubectl apply -f ${pathToYamlDeployment} -n ${namespace}`);
    console.log(`Applied ${pathToYamlDeployment} to namespace ${namespace}`);
    return;
  }

  console.log(`Applying ${pathToYamlDeployment}...`);
  await exec(`./kubectl apply -f ${pathToYamlDeployment}`);
  console.log(`Applied ${pathToYamlDeployment}`);
}

export async function createPodFromImage(name: string, image: string, namespace: string) {
  console.log(`Letting Kubernetes decide how to manage image ${image} with name ${name}`);
  await exec(`./kubectl run ${name} --generator=run-pod/v1 --image=${image} -n ${namespace} -- sleep 999999999`);
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

export async function describeKubernetesResource(kind: string, name: string, namespace: string): Promise<string> {
  const result = await exec(`./kubectl describe ${kind} ${name} -n ${namespace}`);
  return result.stdout;
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

export async function getNamespaces(): Promise<string[]> {
  const commandPrefix = `./kubectl get ns`;
  const onlyNames = ' --template \'{{range .items}}{{.metadata.name}}{{"\\n"}}{{end}}\'';
  const nsOutput = await exec(commandPrefix+onlyNames);
  return nsOutput.stdout.split('\n');
}

export async function getPodLogs(podName: string, namespace: string): Promise<any> {
  const logsOutput = await exec(`./kubectl -n ${namespace} logs ${podName}`);
  return logsOutput.stdout;
}

export async function waitForDeployment(name: string, namespace: string): Promise<void> {
  console.log(`Trying to find deployment ${name} in namespace ${namespace}`);
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await exec(`./kubectl get deployment.apps/${name} -n ${namespace}`);
    } catch (error) {
      await sleep(1000);
    }
  }
  console.log(`Found deployment ${name} in namespace ${namespace}`);

  console.log(`Begin waiting for deployment ${name} in namespace ${namespace}`);
  await exec(`./kubectl wait --for=condition=available deployment.apps/${name} -n ${namespace} --timeout=240s`);
  console.log(`Deployment ${name} in namespace ${namespace} is available`);
}

export async function waitForServiceAccount(name: string, namespace: string): Promise<void> {
  console.log(`Trying to find ServiceAccount ${name} in namespace ${namespace}`);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await exec(`./kubectl get serviceaccount ${name} -n ${namespace}`);
      break;
    } catch (err) {
      await sleep(500);
    }
  }
}

export async function waitForCRD(name: string): Promise<void> {
  console.log(`Trying to find CRD ${name}`);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await exec(`./kubectl get crd ${name}`);
      break;
    } catch (err) {
      await sleep(500);
    }
  }
}

export async function waitForJob(name: string, namespace: string): Promise<void> {
  console.log(`Trying to find job ${name} in namespace ${namespace}`);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await exec(`./kubectl get jobs/${name} -n ${namespace}`);
    } catch (error) {
      await sleep(1000);
    }
  }
  console.log(`Found job ${name} in namespace ${namespace}`);

  console.log(`Begin waiting for job ${name} in namespace ${namespace} to complete`);
  await exec(`./kubectl wait --for=condition=complete jobs/${name} -n ${namespace} --timeout=240s`);
  console.log(`Job ${name} in namespace ${namespace} is complete`);
}

export async function getEvents(namespace: string): Promise<string> {
  const events  = await exec(`./kubectl get events -n ${namespace}`);

  return events.stdout;
}

async function getLatestStableK8sRelease(): Promise<string> {
  const k8sRelease = await needle('get',
    'https://storage.googleapis.com/kubernetes-release/release/stable.txt',
    null,
  ).then((response) => response.body.replace(/[\n\t\r]/g, '').trim());
  console.log(`The latest stable K8s release is ${k8sRelease}`);
  return k8sRelease;
}

export async function verifyPodSecurityPolicy(name: string): Promise<boolean> {
  console.log(`Trying to find Pod Security Policy ${name}`);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await exec(`./kubectl get podsecuritypolicy ${name}`);
      return true;
    } catch (err) {
      await sleep(500);
    }
  }
  return false;
}
