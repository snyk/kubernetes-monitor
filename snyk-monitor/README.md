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

2. (Optional) If you are not using any private registries, create a Kubernetes secret called `snyk-monitor` containing the Snyk Integration ID from the previous step running the following command:
 ```shell
 kubectl create secret generic snyk-monitor -n snyk-monitor --from-literal=dockercfg.json={} --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
 ```
 Continue to Helm installation instructions below.

3. (Optional) If you're using a private registry, you should create a `dockercfg.json` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually your credentials can be found in `$HOME/.docker/config.json`. These must also be added to the `dockercfg.json` file.

Create a file named `dockercfg.json`. Store your credentials in there; it should look like this:

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
  
  // If your cluster runs on EKS and you are using ECR, add the following:
  {
	"credsStore": "ecr-login"
  }
  
  With Docker 1.13.0 or greater, you can configure Docker to use different credential helpers for different registries.
  To use this credential helper for a specific ECR registry, create a credHelpers section with the URI of your ECR registry:
  
  {
	"credHelpers": {
		"public.ecr.aws": "ecr-login",
		"<aws_account_id>.dkr.ecr.<region>.amazonaws.com": "ecr-login"
	}
  }

}
```
Finally, create the secret in Kubernetes by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234
```

4. (Optional) If your private registry requires installing certificates (*.crt, *.cert, *.key only) please put them in a folder and create the following ConfigMap:
```shell
kubectl create configmap snyk-monitor-certs -n snyk-monitor --from-file=<path_to_certs_folder>
```

5. (Optional) If you are using an insecure registry or your registry is using unqualified images, you can provide a `registries.conf` file. See [the documentation](https://github.com/containers/image/blob/master/docs/containers-registries.conf.5.md) for information on the format and examples.

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

**Please note that `/` in cluster name is disallowed. Any `/` in cluster names will be removed.**

## Upgrades ##

You can apply the latest version of the YAML installation files to upgrade.

If you would like to reuse the last release's values and merge in any overrides from the command line via --set and -f, you can use the option `--reuse-values`. For example:
```bash
helm upgrade snyk-monitor snyk-charts/snyk-monitor -n snyk-monitor --reuse-values
```
If '--reset-values' is specified, this is ignored.

If running with Operator Lifecycle Manager (OLM) then OLM will handle upgrades for you when you request to install the latest version. This applies to OpenShift (OCP) and regular installations of OLM.

## Sysdig Integration ##

We have partnered with Sysdig to enrich the issues detected by Snyk for workloads with runtime data provided by Sysdig.

In order for the integration with Sysdig to work, the Snyk monitor requires an extra Secret in the `snyk-monitor` namespace. The Secret name is `sysdig-eve-secret`.

Please refer to the [Sysdig Secret installation guide](https://docs.sysdig.com/en/docs/sysdig-secure/integrate-effective-vulnerability-exposure-with-snyk/#copy-the-sysdig-secret) to install the Secret. Once the Sysdig Secret is installed, you need to copy it over to the snyk-monitor namespace:

```bash
kubectl get secret sysdig-eve-secret -n sysdig-agent -o yaml | grep -v '^\s*namespace:\s' | kubectl apply -n snyk-monitor  -f -
```

To enable Snyk to integrate with Sysdig and collect information about packages executed at runtime, use `--set sysdig.enabled=true` when installing the snyk-monitor:

```bash
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set sysdig.enabled=true
```

> NOTE: The above command should be executed right after installing Sysdig. This will upgrade or install the snyk monitor, to allow the detection of Sysdig in the cluster.

The snyk-monitor will now collect data from Sysdig every 4 hours.

## Setting up proxying ##

Proxying traffic through a forwarding proxy can be achieved by setting the following values in the Helm chart:

* http_proxy
* https_proxy
* no_proxy

For example:

```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set https_proxy=http://192.168.99.100:8080
```

The `snyk-monitor` currently works with HTTP proxies only.

Note that `snyk-monitor` does not proxy requests to the Kubernetes API server.

Note that `snyk-monitor` does not support wildcards or CIDR addresses in `no_proxy` -- it will only look for exact matches. For example:

```shell
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
```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set log_level="WARN"
```

## Using a PVC ##

By default, `snyk-monitor` uses an emptyDir for temporary storage. If you prefer to have a PVC that uses a statically or
 dynamically provisioned PV that you have created, then set the following value
* `pvc.enabled`=`true`

If you would also like to create the PVC (if not using an existing one) then set the following value
* `pvc.create`=`true`

The PVC's name defaults to `snyk-monitor-pvc`. If you prefer to override this, then use the following value:
* `pvc.name`

For example, run the following for first-time setup:
`--set pvc.enabled=true --pvc.create=true`

And run the following for subsequent upgrades:
`--set pvc.enabled=true`

## PodSecurityPolicies
**This should not be used when installing on OpenShift.**

Using PodSecurityPolicies can be achieved by setting the following values in the Helm chart:
* psp.enabled - default is `false`. Set to `true` if PodSecurityPolicy is needed
* psp.name - default is empty. Leave it empty if you want us to install the necessary PodSecurityPolicy. Modify it to specify an existing PodSecurityPolicy rather than creating a new one.

For example:
```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set psp.enabled=true
```

## Configuring excluded namespaces ##

By default, `snyk-monitor` does not scan containers that are internal to Kubernetes, in the following namespaces:
* `kube-node-lease`
* `kube-public`
* `kube-system`
* `local-path-storage`

If you prefer to override this, you can add your own list of namespaces to exclude by setting the `excludedNamespaces` to your own list. For example:
```yaml
--set excludedNamespaces="{kube-node-lease,kube-public,local-path-storage,some_namespace}"
```

## Using EKS without assigning an IAM role to a Node Group

If you do not want to assign an IAM role to a Node Group, you can use the IAM role for Service Accounts and configure the snyk-monitor as follows:
- Setting an IAM role for a service account: [IAM role for a Service Accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- Modify the fsGroup of the mounted EKS credentials in snyk-monitor to the user `nobody` (uid `65534`)
- Annotate the snyk-monitor service account with the IAM role
```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set securityContext.fsGroup=65534 \
  --set rbac.serviceAccount.annotations."eks.amazonaws.com/role-arn"="<iam role name>" \
  --set volumes.projected.serviceAccountToken=true
```

## Configuring resources

If more resources is required in order to deploy snyk-monitor, you can configure the helm charts default value for requests and limits with the `--set` flag.
```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set requests."ephemeral-storage"="50Gi"
  --set limits."ephemeral-storage"="50Gi"
```

## Using custom CA certificate
You can provide custom CA certificates to use for validating TLS connections by adding them to a ConfigMap named snyk-monitor-certs. These additional certificates are used when pulling images from container registries.

If running Snyk on-prem, you can also use a custom CA certificate to validate the connection to kubernetes-upstream for sending scan results by providing the certificate under the following path in the ConfigMap: /srv/app/certs/ca.pem

## Terms and conditions ##

*The Snyk Container Kubernetes integration uses Red Hat UBI (Universal Base Image).*

*Before downloading or using this application, you must agree to the Red Hat subscription agreement located at redhat.com/licenses. If you do not agree with these terms, do not download or use the application. If you have an existing Red Hat Enterprise Agreement (or other negotiated agreement with Red Hat) with terms that govern subscription services associated with Containers, then your existing agreement will control.*
