# Testing the Kubernetes-Monitor #

The Kubernetes-Monitor has different testing suites, each with different purposes and requirements.
All our tests prefer a blackbox approach whenever possible.

Different tests have different requirements in terms of software and environment variables. Requirements specific to one test suite will be described in each section, but the requirements shared by all of them are:
1. npm
2. Node (v10 or higher)

In order to run the Kubernetes-Monitor's tests, please run
`npm test`.

## Unit Tests ##

These tests aim to check a single function, class or module.
Our unit tests aren't thoroughly mocked, resulting in some tests' code reaching the Kubernetes client library we're using, adding noise and/or failures to some unit tests.
Until this is fixed, one workaround is setting one's KUBECONFIG environment variable to a valid kubeconfig file.

Run with `npm run test:unit`.

## System Tests ##

System tests are supposed to test the Kubernetes-Monitor as a stand-alone component with as little external dependencies as possible. They are also supposed to completely cover the core functionality, so mocking or ignoring the Kubernetes API is out of the question.
The resulting infrastructure is comprised of a local KinD cluster (like our integration tests) but does not install the Kubernetes-Monitor inside it. Rather, it runs the Kubernetes-Monitor's code as part of the test, and configures it against the KinD cluster.
This means we're not running in the real runtime environment we expect to run (a Kubernetes cluster), but it's much easier to test the Monitor's outgoing requests or even internal state if we choose to, instead of relying on the Upstream service's state and API.

This test requires Skopeo for MacOS machines, but will install it for Linux machines that don't have it.

Run with `npm run test:system`.

## Integration Tests ##

These tests assert the Kubernetes-Monitor's behaviour mostly through its affect on our Upstream service's state.

All integration tests require the Kubernetes-Monitor to be built into an image on the local machine and be named and tagged as:
`snyk/kubernetes-monitor:local`.
The easiest way to achieve it is by running the `scripts/build-image.sh` script.
Please note that `docker` needs to be installed in order for this script to succeed.

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

Run with `npm run test:integration:kind`.

### EKS ###

EKS is Amazon's Kubernetes platform and helps us ensure we support not only the generic Kubernetes API, but also specificly EKS.

This test uses an existing Amazon account with an existing EKS cluster, and as such has a few more prerequisites:
- `pip` is used to ensure the `aws` CLI is installed and up to date. `aws` is then used to generate a `kubeconfig` file to access the EKS cluster, as well as credentials to ECR.
- AWS environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` are used to authenticate against the Amazon account.
- `docker` is used to push the Kubernetes-Monitor's image to ECR.

This test runs whenever we commit to our `staging` branch, and at the moment may only run once concurrently since it uses the same cluster.

Run with `npm run test:integration:eks`.

### OpenShift 4 ###

OpenShift is RedHat's Kubernetes platform and helps us ensure we support not only the generic Kubernetes API, but also specifically OpenShift 4.

This test uses an existing OpenShift 4 account with an existing OpenShift 4 cluster, and as such has a few more prerequisites:
- The following environment variables: `OPENSHIFT4_USER`, `OPENSHIFT4_PASSWORD`, `OPENSHIFT4_CLUSTER_URL` are used to authenticate against the cluster.

This test runs whenever we commit to our `staging` branch, and at the moment may only run once concurrently since it uses the same cluster.

Run with `npm run test:integration:openshift4`.

### Package Managers ###

These tests attempt to provide some more thorough coverage for our scans of specific package manager: APK, APT and RPM.

These tests run whenever we commit to any branch.

Run with:
* `npm run test:integration:apk`
* `npm run test:integration:apt`
* `npm run test:integration:rpm`
