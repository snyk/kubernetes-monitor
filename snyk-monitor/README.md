# snyk/kubernetes-monitor-chart #

## Summary ##

A Helm chart for the Snyk monitor

## Installing ##

The Snyk monitor (`kubernetes-monitor`) requires some minimal configuration items in order to work correctly.

As with any Helm chart deployment, a namespace must be provisioned first.
You can run the following command to create the namespace:
```shell
kubectl create namespace snyk-monitor
```
Notice our namespace is called _snyk-monitor_ and it is used for the following commands in scoping the resources.


The Snyk monitor relies on using your Snyk Integration ID, and using a `dockercfg` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually a copy of the `dockercfg` resides in `$HOME/.docker/config.json`.

Both of these items must be provided by a Kubernetes secret. The secret must be called _snyk-monitor_. The steps to create the secret are as such:

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

If access to private registries is not needed, the `dockercfg.json` file contents should look like this:

```json
{}
```

2. Locate your Snyk Integration ID from the Snyk Integrations page (navigate to https://app.snyk.io/org/YOUR-ORGANIZATION-NAME/manage/integrations/kubernetes) and copy it. The Snyk Integration ID looks similar to the following:
```
abcd1234-abcd-1234-abcd-1234abcd1234
```
The Snyk Integration ID is used in the `--from-literal=integrationId=` parameter in the next step.

3. Finally, create the secret in Kubernetes by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
```

Note that the secret _must_ be namespaced, and the namespace (which we configured earlier) is called _snyk-monitor_.

## Installation from Helm repo ##

Add Snyk's Helm repo:

```shell
helm repo add snyk-charts https://snyk.github.io/kubernetes-monitor/
```

Run the following command to launch the Snyk monitor in your cluster:

```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor --namespace snyk-monitor --set clusterName="Production cluster"
```

To better organise the data scanned inside your cluster, the monitor requires a cluster name to be set.
Replace the value of `clusterName` with the name of your cluster.


For Helm 3, you may run the following:
```shell
helm upgrade --generate-name --install snyk-monitor snyk-charts/snyk-monitor --namespace snyk-monitor --set clusterName="Production cluster"
```

## Setting up proxying ##

Proxying traffic through a forwarding proxy can be achieved by setting the following values in the Helm chart:

* http_proxy
* https_proxy
* no_proxy

For example:

```bash
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set https_proxy=http://192.168.99.100:8080
```

Note that `snyk-monitor` does not proxy requests to the Kubernetes API server.

Note that `snyk-monitor` does not support wildcards or CIDR addresses in `no_proxy` -- it will only look for exact matches. For example:

```bash
# not ok:
helm upgrade --install ... \
  --set no_proxy=*.example.local,*.other.global,192.168.0.0/16

# ok:
helm upgrade --install ... \
  --set no_proxy=long.domain.name.local,example.local
```
