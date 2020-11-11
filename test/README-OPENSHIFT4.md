# Setup for OpenShift 4 tests #

## Cluster and Operator setup ##

### Set up a local OpenShift 4 cluster using CodeReady Containers ###

Install the OpenShift CLI tool:

```shell
brew install openshift-cli
```

Download CodeReady Containers: [https://cloud.redhat.com/openshift/install/crc/installer-provisioned](https://cloud.redhat.com/openshift/install/crc/installer-provisioned). To authenticate to Red Hat, search in 1Password: `k3wfyid3zlu2ce2tzrwyd27gky`.

Install CRC as noted in the above website:

> Download and extract the CodeReady Containers archive for your operating system and place the binary in your $PATH. Run the crc setup command to set up your host operating system for the CodeReady Containers virtual machine.
>
> Once `crc setup` is run, then run `crc start`. Provide the image pull secrets by copying it from [https://cloud.redhat.com/openshift/install/crc/installer-provisioned](https://cloud.redhat.com/openshift/install/crc/installer-provisioned) (click on Copy pull secret).

Follow the instructions from `crc start` to see how to login to the cluster. If you need to see the login credentials, run `crc console --credentials`.

---

## Required environment variables ##

Use `crc console --credentials` to view your local OpenShift credentials.
See `/private/etc/hosts` for the cluster URL.

For testing against the OpenShift integration tests cluster (as used on merged PRs in CI/CD) see ":key: OpenShift Test Cluster - Runtime".

Using the above credentials set the following environment variables:

- QUAY_USERNAME (search in 1Password: xnz2hv2h3bdwriove2zlbnlwhq)
- QUAY_PASSWORD (search in 1Password: xnz2hv2h3bdwriove2zlbnlwhq)
- DOCKERHUB_USER (search in 1Password: mrvhrhni3jdj3mjzlf3u3zfhgm)
- DOCKERHUB_PASSWORD (search in 1Password: mrvhrhni3jdj3mjzlf3u3zfhgm)
- OPENSHIFT4_USER (crc console --credentials)
- OPENSHIFT4_PASSWORD (crc console --credentials)
- OPENSHIFT4_CLUSTER_URL (crc console --credentials)

Optionally set KUBERNETES_MONITOR_IMAGE_TAG to a released kubernetes-monitor tag. Alternatively the tests will build the whole kubernetes-monitor image (WARNING: this is very slow!).

## Running tests ##

Double-check that the required environment variables are set and that your OpenShift VM is running.

Finally, run:

```shell
npm run test:integration:openshift4:operator
```
