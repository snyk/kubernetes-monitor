# snyk/kubernetes-monitor #

## Summary ##
Container to monitor Kubernetes clusters' security

## Prerequisites ##

*Note that at present the monitor works only if using Docker as the container runtime.*

The Snyk monitor (`kubernetes-monitor`) requires some minimal configuration items in order to work correctly.

As with any Kubernetes deployment, the `kubernetes-monitor` runs within a single namespace.
If you do not already have access to a namespace where you want to deploy the monitor, you can run the following command to create one:
```shell
kubectl create namespace snyk-monitor
```
Notice our namespace is called _snyk-monitor_ and it is used for the following commands in scoping the resources.


The Snyk monitor relies on using your Snyk Integration ID, and using a `dockercfg` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually a copy of the `dockercfg` resides in `$HOME/.docker/config.json`.

Both of these items must be provided from a Kubernetes secret. The secret must be called _snyk-monitor_. The steps to create the secret are as such:

1. Create a file named `dockercfg.json`. Store your `dockercfg` in there; it should look like this:

```json
{
  "auths": {
    "gcr.io": {
      "auth": "BASE64-ENCODED-AUTH-DETAILS"
    }
    // Add other registries as necessary
  }
}
```

2. Locate your Snyk Integration ID from the Snyk Integrations page (navigate to https://app.snyk.io/org/YOUR-ORGANIZATION-NAME/manage/integrations/kubernetes) and copy it.
The Snyk Integration ID is a UUID and looks similar to the following:
```
abcd1234-abcd-1234-abcd-1234abcd1234
```
The Snyk Integration ID is used in the `--from-literal=integrationId=` parameter in the next step.

3. Finally, create the secret in Kubernetes by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
```

Note that the secret _must_ be namespaced, and the namespace (which we configured earlier) is called _snyk-monitor_.


The `kubernetes-monitor` can run in one of two modes: constrained to a single namespace, or with access to the whole cluster.
In other words, the monitor can scan containers in one particular namespace, or it can scan all containers in your cluster.
The choice of which deployment to use depends on the permissions you have on your cluster.

For _cluster_-scoped deployment you can create the necessary `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` required for the monitor's deployment.
These objects ensure the monitor has the right (limited) level of access to resources in the cluster. The command is as follows:
```shell
kubectl apply -f snyk-monitor-cluster-permissions.yaml
```
Note that even though the monitor operates in the whole cluster, the `ClusterRole` ensures it can only _read_ or _watch_ resources; the monitor can never modify your objects!

For a _namespaced_ deployment you can create the necessary `ServiceAccount`, `Role`, and `RoleBinding` required for the monitor's deployment:
```shell
kubectl apply -f snyk-monitor-namespaced-permissions.yaml
```
Similarly to the cluster-scoped deployment, this `Role` ensures the monitor can only _read_ or _watch_ resources, never to modify them!

By default, the Snyk monitor sends workload information to Snyk using a default cluster name.
To _change the cluster name_, you can modify `snyk-monitor-namespaced-permissions.yaml` (for the Namespaced deployment) or `snyk-monitor-cluster-permissions.yaml` (for the Cluster-scoped deployment) and set the string value of `clusterName` to the name of your cluster. You will now see your workloads appearing in Snyk under the new cluster name.


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
