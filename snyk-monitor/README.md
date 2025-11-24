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


The Snyk monitor relies on using your Snyk Integration ID and Snyk Service Account Token which must be provided from a Kubernetes secret. The secret must be called _snyk-monitor_. The steps to create the secret are as such:

1. Locate your Snyk Integration ID from the Snyk Integrations page (navigate to https://app.snyk.io/org/YOUR-ORGANIZATION-NAME/manage/integrations/kubernetes) and copy it.
The Snyk Integration ID is a UUID and looks similar to the following:
```
abcd1234-abcd-1234-abcd-1234abcd1234
```
The Snyk Integration ID is used in the `--from-literal=integrationId=` parameter in step 3.

2. Create a Group or Org Service Account Token as described in [Snyk Service Account public documentation](https://docs.snyk.io/user-and-group-management/structure-account-for-high-application-performance/service-accounts). There are 3 different roles which will allow the integration to publish data:
-- Group Admin
-- Org Admin
-- Org custom role with the permission: “Publish Kubernetes Resources”

The Snyk Service Account Token is a UUID and looks similar to the following:
```
aabb1212-abab-1212-dcba-4321abcd4321
```

The Snyk Service Account Token is used in the `--from-literal=serviceAccountApiToken=` parameter in step 3.

3. (Optional) If you are only using **public container registries**, create a Kubernetes secret called `snyk-monitor` containing the Snyk Integration ID from step 1 and the service account token from step 2:
 ```shell
 kubectl create secret generic snyk-monitor -n snyk-monitor --from-literal=dockercfg.json={} --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234 --from-literal=serviceAccountApiToken=aabb1212-abab-1212-dcba-4321abcd4321
 ```
 Continue to [Helm installation instructions](#installation-from-helm-repo) below.

4. (Optional) If you're using any **private container registries**, you should create a `dockercfg.json` file. The `dockercfg` file is necessary to allow the monitor to look up images in private registries. Usually your credentials can be found in `$HOME/.docker/config.json`. These must also be added to the `dockercfg.json` file.

Create a file named `dockercfg.json`. Store your credentials in there; it should look like this:

```hjson
// If your cluster does not run on GKE or it runs on GKE and pulls images from other private registries, add the following:
{
  "auths": {
    "gcr.io": {
      "auth": "BASE64-ENCODED-AUTH-DETAILS"
    }
    // Add other registries as necessary
  }
}
```
```hjson
// If your cluster runs on GKE and you are using GCR, add the following:
{
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
```hjson
// If your cluster runs on EKS and you are using ECR, add the following:
{
  "credsStore": "ecr-login"
}
```

```hjson
// If your cluster runs on AKS and you're using ACR, add the following:
{
  "credHelpers": { 
    "myregistry.azurecr.io": "acr-env"
  }
}

// Additionally, see https://azure.github.io/azure-workload-identity/docs/topics/service-account-labels-and-annotations.html#service-account
// You may need to configure labels and annotations on the snyk-monitor ServiceAccount
```

```hjson
// You can configure different credential helpers for different registries. 
// To use this credential helper for a specific ECR registry, create a credHelpers section with the URI of your ECR registry:
{
  "credHelpers": {
    "public.ecr.aws": "ecr-login",
    "<aws_account_id>.dkr.ecr.<region>.amazonaws.com": "ecr-login"
  }
}
```
Finally, create the secret in Kubernetes by running the following command:
```shell
kubectl create secret generic snyk-monitor -n snyk-monitor --from-file=./dockercfg.json --from-literal=integrationId=abcd1234-abcd-1234-abcd-1234abcd1234 --from-literal=serviceAccountApiToken=aabb1212-abab-1212-dcba-4321abcd4321
```

5. (Optional) If your private registry requires installing certificates (_.crt,_.cert, *.key only) please put them in a folder and create the following Secret:

```shell
kubectl create secret tls snyk-monitor-certs -n snyk-monitor --cert=path/to/tls.crt --key=path/to/tls.key
```

6. (Optional) If you are using an insecure registry or your registry is using unqualified images, you can provide a `registries.conf` file. See [the documentation](https://github.com/containers/image/blob/master/docs/containers-registries.conf.5.md) for information on the format and examples.

Create a file named `registries.conf`, see example adding an insecure registry: 

```conf
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

Note that the Snyk monitor has **read-only** access to workloads in the cluster and will never interfere with other applications. The exact permissions requested by the monitor can be seen in the [ClusterRole](./templates/clusterrole.yaml) or [Role](./templates/role.yaml).

### Installation and monitoring of the whole cluster

Run the following command to launch the Snyk monitor in your cluster:

```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster"
```

To better organise the data scanned inside your cluster, the monitor requires a cluster name to be set.
Replace the value of `clusterName` with the name of your cluster.

Please note that if provided, the supplied cluster name:
- must be up to 62 characters long
- must contain only alpha numeric characters, dashes, underscores, spaces and `.:()`
- must have at least one non space character

i.e. must match the regex `^[a-zA-Z0-9_:() \.\-]{0,62}$`

### Installation and monitoring of a single namespace

The Snyk monitor can be configured to monitor only the namespace in which it is installed instead of the whole cluster:

```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace some-ns-to-be-monitored \ # Note: ensure your snyk-monitor secret exists here
  --set scope=Namespaced \ # Monitor only the current namespace
  --set clusterName="Production cluster"
```

## Upgrades ##

You can apply the latest version of the Helm chart to upgrade.

If you would like to reuse the last release's values and merge in any overrides from the command line via --set and -f, you can use the option `--reuse-values`. For example:
```bash
helm upgrade snyk-monitor snyk-charts/snyk-monitor -n snyk-monitor --reuse-values
```
If '--reset-values' is specified, this is ignored.

## Sysdig Integration ##

We have partnered with Sysdig to enrich the issues detected by Snyk for workloads with runtime data provided by Sysdig.

For a successful integration with Sysdig, the Snyk Controller requires an extra Sysdig Secret in the snyk-monitor namespace. The Sysdig Secret name is snyk-sysdig-secret.

Create the snyk-sysdig-secret in the snyk-monitor namespace:
```bash
kubectl create secret generic snyk-sysdig-secret -n snyk-monitor \
  --from-literal=token=$SYSDIG_RISK_SPOTLIGHT_TOKEN \
  --from-literal=endpoint=$SYSDIG_ENDPOINT_URL \
  --from-literal=cluster=$SYSDIG_AGENT_CLUSTER
```
SYSDIG_RISK_SPOTLIGHT_TOKEN is the "Risk Spotlight Integrations Token" and has to be generated via the Sysdig UI. To create this API token, see the
[Sysdig Risk Spotlight guide](https://docs.sysdig.com/en/docs/sysdig-secure/integrations-for-sysdig-secure/risk-spotlight-integrations/#generate-a-token-for-the-integration).
SYSDIG_ENDPOINT_URL is assiciated with your Sysdig SaaS application and region and can be identified from [here](https://docs.sysdig.com/en/docs/administration/saas-regions-and-ip-ranges/) (e.g us2.app.sysdig.com, note that 'https://' prefix has to be omitted).
SYSDIG_AGENT_CLUSTER is the one that you configured when [installing the Sysdig Agent](https://docs.sysdig.com/en/docs/installation/sysdig-secure/install-agent-components/kubernetes/#parameter-definitions) - global.clusterConfig.name.

To enable Snyk to integrate with Sysdig and collect information about packages executed at runtime, use `--set sysdig.enabled=true` when installing the snyk-monitor:

```bash
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  --set clusterName="Production cluster" \
  --set sysdig.enabled=true
```

> NOTE: The above command should be executed after installing Sysdig. This will upgrade or install the snyk monitor, to allow the detection of Sysdig in the cluster.

The snyk-monitor will now collect data from Sysdig every 30 mins.

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

## Using AKS with Managed Identities

For the particular case when you are using AKS with user-managed identities to authorize access to ACR and there are multiple identities that assign the `AcrPull` role to the VM scale set, you must also specify the Client ID of the desired user-managed identity to be used. This value must be set as an override, in `.Values.azureEnvVars`:
```yaml
azureEnvVars:
  - name: AZURE_CLIENT_ID
    value: "abcd1234-abcd-1234-abcd-1234abcd1234"
```

With the YAML above saved in `override.yaml`, run the following:

```shell
helm upgrade --install snyk-monitor snyk-charts/snyk-monitor \
  --namespace snyk-monitor \
  -f override.yaml
```

By default, this value is an empty string, and it will not be used as such.

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

## Helm chart extensibility ##

### Additional Kubernetes volumes and volume mounts ###

The helm chart supports mounting custom volumes in addition to the built-in ones through the use of `extraVolumes` and `extraVolumeMounts`.

**Note** that `extraVolumes` are available to all containers in the snyk-monitor deployment (including any init containers), whilst `extraVolumeMounts` applies only to the main snyk-monitor container.

#### Example ####

Let's say you need to mount in an additional kubernetes secret that is created outside of the snyk-monitor chart. You would define the following in your `values.yaml`:

```yaml
extraVolumes:
  # this volume will be available to all containers in the deployment
  - name: "my-k8s-secret"
    secret:
      secretName: "name-of-my-k8s-secret-resource" # kubernetes secret created elsewhere

extraVolumeMounts:
  # this mounts the kubernetes secret into the main snyk-monitor container
  - mountPath: "/mnt/additional-secrets"
    name: "my-k8s-secret"
    readOnly: true
```

### Additional init containers ###

The helm chart supports specifying additional init containers that will run before the main snyk-monitor container through the use of `extraInitContainers`. This field is templated ie. Helm will parse any helm template directives within the specification.

#### Example ####

Continuing on with the example above for additional volumes, let's say you need to have a secret copied into a specific path in the main snyk-monitor container before it is started. You would define the following in your `values.yaml`:

```yaml
extraInitContainers:
  - name: install-my-secret
    # notice how the image specification is templated. This would result in running the same
    # image as the built-in 'volume-permissions' init container.
    image: "{{ .Values.initContainerImage.repository }}:{{ .Values.initContainerImage.tag }}"
    command: ['sh', '-c', 'cp -f /mnt/my-secrets/my-secret /srv/app/my-secret || :']
    volumeMounts:
      # this brings the kubernetes secret from the previous example into this init container
      - mountPath: "/mnt/my-secrets"
        name: "my-k8s-secret"
        readOnly: true
```

## Terms and conditions ##

Note that these terms and conditions apply when installing the Snyk Kubernetes Monitor which uses the Red Hat UBI, denoted by `-ubi9` in the image tag.

*Before downloading or using this application, you must agree to the Red Hat subscription agreement located at redhat.com/licenses. If you do not agree with these terms, do not download or use the application. If you have an existing Red Hat Enterprise Agreement (or other negotiated agreement with Red Hat) with terms that govern subscription services associated with Containers, then your existing agreement will control.*
