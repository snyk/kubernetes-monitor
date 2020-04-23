
[![Known Vulnerabilities](https://snyk.io/test/github/snyk/kubernetes-monitor/badge.svg)](https://snyk.io/test/github/snyk/kubernetes-monitor)

# snyk/kubernetes-monitor #

## Summary ##

Container to monitor Kubernetes clusters' security

## Prerequisites ##

* 50 GB of storage in the form of [emptyDir](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir).
* External internet access from the Kubernetes cluster.

## Installing ##

The Snyk monitor (`kubernetes-monitor`) requires some minimal configuration items in order to work correctly.

As with any Kubernetes deployment, the `kubernetes-monitor` runs within a single namespace.
If you do not already have access to a namespace where you want to deploy the monitor, you can run the following command to create one:
```shell
kubectl create namespace snyk-monitor
```
Notice our namespace is called _snyk-monitor_ and it is used for the following commands in scoping the resources.


The Snyk monitor relies on using your Snyk Integration ID, which must be provided from a Kubernetes secret. The secret must be called _snyk-monitor_. The steps to create the secret are as such:

1. Locate your Snyk Integration ID from the Snyk Integrations page (navigate to https://app.snyk.io/org/YOUR-ORGANIZATION-NAME/manage/integrations/kubernetes) and copy it.
The Snyk Integration ID is a UUID and looks similar to the following:
```
abcd1234-abcd-1234-abcd-1234abcd1234
```
The Snyk Integration ID is used in the `--from-literal=integrationId=` parameter in the next step.

2. If you are not using any private registries, create a Kubernetes secret called `snyk-monitor` containing the Snyk Integration ID from the previous step running the following command:
 ```shell
 kubectl create secret generic snyk-monitor -n snyk-monitor --from-literal=dockercfg.json={} --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
 ```
 Continue to YAML files installation instructions below.

3. If we're using a private registry, you should create a `dockercfg` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually a copy of the `dockercfg` resides in `$HOME/.docker/config.json`.

Create a file named `dockercfg.json`. Store your `dockercfg` in there; it should look like this:

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
Finally, create the secret in Kubernetes by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
```

## Installation from YAML files ##

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

## Setting up proxying ##

Proxying traffic through a forwarding proxy can be achieved by modifying the `snyk-monitor-cluster-permissions.yaml` or `snyk-monitor-namespaced-permissions.yaml` (depending on which one was applied) and setting the following variables in the `ConfigMap`:

* http_proxy
* https_proxy
* no_proxy

For example:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  ...
data:
  ...
  https_proxy: "http://192.168.99.100:8080"
```

The `snyk-monitor` currently works with HTTP proxies only.

Note that `snyk-monitor` does not proxy requests to the Kubernetes API server.

Note that `snyk-monitor` does not support wildcards or CIDR addresses in `no_proxy` -- it will only look for exact matches. For example:

```yaml
# not OK:
no_proxy: *.example.local,*.other.global,192.168.0.0/16

# OK:
no_proxy: long.domain.name.local,example.local
```
