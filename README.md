
[![Known Vulnerabilities](https://snyk.io/test/github/snyk/kubernetes-monitor/badge.svg)](https://snyk.io/test/github/snyk/kubernetes-monitor)

# snyk/kubernetes-monitor #

## Summary ##

Container to monitor Kubernetes clusters' security

## Prerequisites ##

* 50 GiB of storage in the form of [emptyDir](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir).
* External internet access from the Kubernetes cluster, specifically to `kubernetes-upstream.snyk.io`.
* 1 CPU, 2 GiB RAM
* 1 Kubernetes worker node of type `linux/amd64` - supported and tested only on the AMD64 CPU architecture

Supported Kubernetes distributions:

* Any Kubernetes Certified distribution, for example: GKE, AKS, EKS, OCP.
* OCP 4.1+ if running on OpenShift - supported and tested on Generally Available versions

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

```hjson
{
  // If your cluster does not run on GKE or it runs on GKE and pulls images from other private registries, add the following:
  "auths": {
    "gcr.io": {
      "auth": "BASE64-ENCODED-AUTH-DETAILS"
    }
    // Add other registries as necessary
  },
  
  // If your cluster runs on GKE and you are using GCR, add the following:
  "credHelpers": {
    "us.gcr.io": "gcloud",
    "asia.gcr.io": "gcloud",
    "marketplace.gcr.io": "gcloud",
    "gcr.io": "gcloud",
    "eu.gcr.io": "gcloud",
    "staging-k8s.gcr.io": "gcloud"
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

## Upgrades ##

You can apply the latest version of the YAML installation files to upgrade.

If running with Operator Lifecycle Manager (OLM) then OLM will handle upgrades for you when you request to install the latest version. This applies to OpenShift (OCP) and regular installations of OLM.

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

## Changing log level ##

To lower `snyk-monitor`'s logging verbosity `log_level` value could be set to one of these options:
* `'WARN'`
* `'ERROR'`

By default, `log_level` is `'INFO'`.

## Using a PVC ##

By default, `snyk-monitor` uses an emptyDir for temporary storage. If you prefer to have a PVC that uses a statically or
 dynamically provisioned PV that you have created, then set the following value
* `pvc.enabled` `true`

The PVC's name defaults to `snyk-monitor-pvc`. If you prefer to override this, then use the following value:
* `pvc.name`

## Terms and conditions ##

*The Snyk Container Kubernetes integration uses Red Hat UBI (Universal Base Image).*

*Before downloading or using this application, you must agree to the Red Hat subscription agreement located at redhat.com/licenses. If you do not agree with these terms, do not download or use the application. If you have an existing Red Hat Enterprise Agreement (or other negotiated agreement with Red Hat) with terms that govern subscription services associated with Containers, then your existing agreement will control.*
