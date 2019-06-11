# snyk/kubernetes-monitor #

## Summary ##
Container to monitor Kubernetes clusters' security

## Prerequisites ##

*Note that at present the monitor works only if using Docker as the container runtime.*

The Snyk monitor (`kubernetes-monitor`) requires some minimal configuration items in order to work correctly.

As with any k8s deployment, a namespace must be provisioned first.
You can run the following command to create the namespace:
```shell
kubectl create namespace snyk-monitor
```
Notice our namespace is called _snyk-monitor_ and it is used for the following commands in scoping the resources.


The Snyk monitor relies on using your Snyk Integration ID, and using a `dockercfg` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually a copy of the `dockercfg` resides in `$HOME/.docker/config.json`.

Both of these items must be provided by a k8s secret. The secret must be called _snyk-monitor_. The steps to create the secret are as such:

1. Create a file named `dockercfg.json`. Store your `dockercfg` in there; it should look like this:

```json
{
  "auths": {
    "gcr.io": {
      "auth": "<BASE64-ENCODED-AUTH-DETAILS>"
    }
    // Add other registries as necessary
  }
}
```

2. Locate your Snyk Integration ID from the Snyk Integrations page (navigate to https://app.snyk.io/org/YOUR-ORGANIZATION-NAME/manage/integrations/kubernetes) and copy it. The Snyk Integration ID looks similar to the following:
```
abcd1234-abcd-1234-abcd-1234abcd1234
```
The Snyk Integration ID is used in the `--from-literal=integrationId=` parameter in the next step.

3. Finally, create the secret in k8s by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
```

Note that the secret _must_ be namespaced, and the namespace (which we configured earlier) is called _snyk-monitor_.


Next, you can create the necessary `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` required for the monitor's deployment. These objects ensure the monitor has the right (limited) level of access to resources in the cluster. The command is as follows:
```shell
kubectl apply -f snyk-monitor-permissions.yaml
```


Finally, to launch the Snyk monitor in your cluster, run the following:
```shell
kubectl apply -f snyk-monitor-deployment.yaml
```

## Using a local Docker image for testing ##

If you would like to use a locally-built image, then modify the following lines in `snyk-monitor-deployment.yaml` like this:
```yaml
      containers:
      - image: <your-local-image-name:tag>
        imagePullPolicy: Never
```
