import kubernetes
import subprocess

def discover():
  config = kubernetes.config
  config.load_kube_config()
  v1 = kubernetes.client.CoreV1Api()

  allPods = v1.list_pod_for_all_namespaces(watch=False)
  response = []

  for pod in allPods.items:
    for container in pod.spec.containers:
      containerData = {
        "imageName": container.image,
        "containerName": container.name,
        "podName": pod.metadata.name,
        "namespace": pod.metadata.namespace,
      }
      response.append(containerData)

  # import pdb
  # pdb.set_trace()

  # namespace
  # deployments
  # images (name, tags)

  return response
