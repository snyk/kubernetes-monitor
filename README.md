
[![Known Vulnerabilities](https://snyk.io/test/github/snyk/kubernetes-monitor/badge.svg)](https://snyk.io/test/github/snyk/kubernetes-monitor)

# snyk/kubernetes-monitor #

## Summary ##

A containerized application that is deployed with Helm. Monitors the security of a Kubernetes cluster by analyzing container images.

## Prerequisites ##

* 50 GiB of storage in the form of [emptyDir](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir) or a [PersistentVolumeClaim](https://kubernetes.io/docs/concepts/storage/persistent-volumes/).
* External internet access from the Kubernetes cluster to `api.snyk.io`.
* 1 CPU, 2 GiB RAM
* 1 Kubernetes worker node of type `linux/amd64` - supported and tested only on the AMD64 CPU architecture

Supported Kubernetes distributions:

* Any *Generally Available* Kubernetes Certified distribution, for example: GKE, AKS, EKS, OCP.
* OCP 4.1+ if running on OpenShift - supported and tested on *Generally Available* versions

Tested with the following [Security Context Constraint](scc.txt) on OCP.

## Installation with Helm ##

Please refer to the [Helm chart installation instructions](./snyk-monitor/README.md).

## Documentation ##

For detailed documentation and support, please refer to the [Snyk Kubernetes integration documentation](https://docs.snyk.io/products/snyk-container/kubernetes-workload-and-image-scanning).
