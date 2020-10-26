# Setup for OpenShift 4 tests #

## Cluster and Operator setup ##

### Set up a local OpenShift 4 cluster using CodeReady Containers ###

Install the OpenShift CLI tool:

```shell
brew install openshift-cli
```

Download CodeReady Containers: [https://cloud.redhat.com/openshift/install/crc/installer-provisioned](https://cloud.redhat.com/openshift/install/crc/installer-provisioned). Use the credentials `Red Hat / Openshift` to authenticate to Red Hat.

Install CRC as noted in the above website:

> Download and extract the CodeReady Containers archive for your operating system and place the binary in your $PATH. Run the crc setup command to set up your host operating system for the CodeReady Containers virtual machine.
>
> Once `crc setup` is run, then run `crc start`. Provide the image pull secrets by copying it from [https://cloud.redhat.com/openshift/install/crc/installer-provisioned](https://cloud.redhat.com/openshift/install/crc/installer-provisioned) (click on Copy pull secret).

Follow the instructions from `crc start` to see how to login to the cluster. If you need to see the login credentials, run `crc console --credentials`.

### Build and push an Operator image ###

```shell
scripts/operator/<>
scripts/operator/<>
```

---

## Required environment variables ##

Use `crc console --credentials` to view your local OpenShift credentials.
See `/private/etc/hosts` for the cluster URL.

For testing against the OpenShift integration tests cluster (as used on merged PRs in CI/CD) see ":key: OpenShift Test Cluster - Runtime".

Using the above credentials set the following environment variables:

- OPENSHIFT4_USER
- OPENSHIFT4_PASSWORD
- OPENSHIFT4_CLUSTER_URL

Build the `kubernetes-monitor` image using `scripts/docker/build-image.sh` and set:

- KUBERNETES_MONITOR_IMAGE_NAME_AND_TAG
