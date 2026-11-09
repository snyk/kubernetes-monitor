# snyk/kubernetes-monitor

## Summary

A containerized application that is deployed with Helm. Monitors the security of a Kubernetes cluster by analyzing container images.

## Prerequisites

- 50 GiB of storage in the form of [emptyDir](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir) or a [PersistentVolumeClaim](https://kubernetes.io/docs/concepts/storage/persistent-volumes/).
- External internet access from the Kubernetes cluster to `api.snyk.io`.
- 1 CPU, 2 GiB RAM
- 1 Kubernetes worker node of type `linux/amd64` - supported and tested only on the AMD64 CPU architecture

Supported Kubernetes distributions:

- Any _Generally Available_ Kubernetes Certified distribution, for example: GKE, AKS, EKS, OCP.

Tested with the following [Security Context Constraint](scc.txt) on OCP.

## Installation with Helm

Please refer to the [Helm chart installation instructions](./snyk-monitor/README.md).
The chart is also listed on [Artifact Hub](https://artifacthub.io/packages/helm/snyk/snyk-monitor).

## Releases

Release notes for every version are published on the [GitHub Releases page](https://github.com/snyk/kubernetes-monitor/releases).

## Documentation

For detailed documentation and support, please refer to the [Snyk Kubernetes integration documentation](https://docs.snyk.io/products/snyk-container/kubernetes-workload-and-image-scanning).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [testing guide](test/README.md).
