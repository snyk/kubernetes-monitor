# Testing the Kubernetes-Monitor #

The Kubernetes-Monitor has different testing suites, each with different purposes and requirements.
All our tests prefer a blackbox approach whenever possible.

## Unit Tests ##

These tests aim to check a single function, class or module.
Our unit tests aren't thoroughly mocked, resulting in some tests' code reaching the Kubernetes client library we're using, adding noise and/or failures to some unit tests.
Until this is fixed, one workaround is setting one's KUBECONFIG environment variable to a valid kubeconfig file.

## System Tests ##

We don't have this kind of tests yet, but if we did, they would focus on the Kubeneretes-Monitor running as-is, just without its reliance on the Upstream service for validation (That is, assert outgoing requests, mock incoming responses).

## Integration Tests ##

These tests assert the Kubernetes-Monitor's behaviour mostly through its affect on our Upstream service's state.

As part of these tests, we attempt pulling and scanning an image hosted on a private GCR registry. For this test case to work, one has to define the following environment variables: `GCR_IO_SERVICE_ACCOUNT`, `GCR_IO_DOCKERCFG`.

Our integration tests may use different Kubernetes platforms to host the Kubernetes-Monitor. These platforms may use an existing cluster, or create a new one. Both decisions are based on the environment variables:
* `TEST_PLATFORM` (`kind`, `eks`)
* `CREATE_CLUSTER` (`true`, `false`).

All integration tests determine the image to be tested based on the environment variable called `KUBERNETES_MONITOR_IMAGE_NAME_AND_TAG`, and fallback to `snyk/kubernetes-monitor:local`, meaning one has to make sure the image desired to be tested is properly named and tagged.

### KinD ###

KinD is a Kubernetes-inside-Docker project mostly used for simple, light-weight conformance testing against the Kubernetes API.
https://github.com/kubernetes-sigs/kind

Our KinD integration test creates a new KinD cluster locally and deploys the Kubernetes-Monitor there.

This test runs whenever we commit to any branch.

### EKS ###

EKS is Amazon's Kubernetes platform and helps us ensure we support not only the generic Kubernetes API, but also specificly EKS.

This test uses an existing Amazon account with an existing EKS cluster, and as such has a few more prerequisites:
- `pip` is used to ensure the `aws` CLI is installed and up to date. `aws` is then used to generate a `kubeconfig` file to access the EKS cluster, as well as credentials to ECR.
- AWS environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` are used to authenticate against the Amazon account.
- `docker` is used to push the Kubernetes-Monitor's image to ECR.

This test runs whenever we commit to our `staging` branch, and at the moment may only run once concurrently since it uses the same cluster.

### Package Managers ###

These tests attempt to provide some more thorough coverage for our scans of specific package manager: APK, APT and RPM.

These tests run whenever we commit to any branch.
