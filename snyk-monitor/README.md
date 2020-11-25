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
 Continue to Helm installation instructions below.

3. If we're using a private registry, you should create a `dockercfg` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually a copy of the `dockercfg` resides in `$HOME/.docker/config.json`.

Create a file named `dockercfg.json`. Store your `dockercfg` in there; it should look like this:

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
Finally, create the secret in Kubernetes by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
```

4. If your private registry requires installing certificates (*.crt, *.cert, *.key only) please put them in a folder and create the following ConfigMap:
```shell
kubectl create configmap snyk-monitor-certs -n snyk-monitor --from-file=<path_to_certs_folder>
```

5. If you are using an insecure registry or your registry is using unqualified images, you can provide a `registries.conf` file. See [the documentation](https://github.com/containers/image/blob/master/docs/containers-registries.conf.5.md) for information on the format and examples.

Create a file named `registries.conf`, see example adding an insecure registry: 

```
[[registry]]
location = "internal-registry-for-example.net/bar"
insecure = true
```

Once you've created the file, you can use it to create the following ConfigMap:
```shell
kubectl create configmap snyk-monitor-registries-conf -n snyk-monitor --from-file=<path_to_registries_conf_file>
```

## Installation from Helm repo ##

Add the latest version of Snyk's Helm repo:

```shell
helm repo add snyk-charts https://snyk.github.io/kubernetes-monitor/ --force-update
```

Run the following command to launch the Snyk monitor in your cluster:

```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor --namespace snyk-monitor --set clusterName="Production cluster"
```

To better organise the data scanned inside your cluster, the monitor requires a cluster name to be set.
Replace the value of `clusterName` with the name of your cluster.

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

The `snyk-monitor` currently works with HTTP proxies only.

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

## Changing log level ##

To lower `snyk-monitor`'s logging verbosity `log_level` value could be set to one of these options:
* `'WARN'`
* `'ERROR'`

By default, `log_level` is `'INFO'`.

For example
```bash
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set log_level="WARN"
```

## PodSecurityPolicies
**This should not be used when installing on OpenShift.**

Using PodSecurityPolicies can be achieved by setting the following values in the Helm chart:
* psp.enabled - default is `false`. Set to `true` if PodSecurityPolicy is needed
* psp.name - default is empty. Leave it empty if you want us to install the necessary PodSecurityPolicy. Modify it to specify an existing PodSecurityPolicy rather than creating a new one.

For example:
```bash
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set psp.enabled=true
```

## Terms and conditions ##

*The Snyk Container Kubernetes integration uses Red Hat UBI (Universal Base Image).*

*Before downloading or using this application, you must agree to the Red Hat subscription agreement located at redhat.com/licenses. If you do not agree with these terms, do not download or use the application. If you have an existing Red Hat Enterprise Agreement (or other negotiated agreement with Red Hat) with terms that govern subscription services associated with Containers, then your existing agreement will control.*
