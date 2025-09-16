# Testing the Kubernetes-Monitor

- [Testing the Kubernetes-Monitor](#testing-the-kubernetes-monitor)
  - [Unit Tests](#unit-tests)
  - [System Tests](#system-tests)
  - [Debugging with Tilt](#debugging-with-tilt)
    - [Start a debugging session](#start-a-debugging-session)
    - [Errors with read-only file system](#errors-with-read-only-file-system)
    - [Cleaning up](#cleaning-up)

The Kubernetes-Monitor has different testing suites, each with different purposes and requirements.
All our tests prefer a blackbox approach whenever possible.

Different tests have different requirements in terms of software and environment variables. Requirements specific to one test suite will be described in each section, but the requirements shared by all of them are:

1. npm
2. Node (v10 or higher)

In order to run the Kubernetes-Monitor's tests, please run
`npm test`

## Unit Tests

These tests aim to check a single function, class or module.
Our unit tests aren't thoroughly mocked, resulting in some tests' code reaching the Kubernetes client library we're using, adding noise and/or failures to some unit tests.
Until this is fixed, one workaround is setting one's KUBECONFIG environment variable to a valid kubeconfig file.

Run with `npm run test:unit`.

## System Tests

System tests are supposed to test the Kubernetes-Monitor as a stand-alone component with as little external dependencies as possible. They are also supposed to completely cover the core functionality, so mocking or ignoring the Kubernetes API is out of the question.
The resulting infrastructure is comprised of a local KinD cluster (like our integration tests) but does not install the Kubernetes-Monitor inside it. Rather, it runs the Kubernetes-Monitor's code as part of the test, and configures it against the KinD cluster.
This means we're not running in the real runtime environment we expect to run (a Kubernetes cluster), but it's much easier to test the Monitor's outgoing requests or even internal state if we choose to, instead of relying on the Upstream service's state and API.

This test requires Skopeo for MacOS machines, but will install it for Linux machines that don't have it.

Run with `npm run test:system`.

## Debugging with Tilt

Tilt allows you to run and debug the snyk-monitor while it is running in a container. Tilt deploys the snyk-monitor using the same Helm chart that we publish to users.

You can download Tilt from the [Tilt GitHub repository](https://github.com/tilt-dev/tilt#install-tilt).

### Start a debugging session

First, ensure you have the snyk-monitor namespace set up and the snyk-monitor Secret with your integration ID and dockercfg (as per the prerequisites for installing snyk-monitor).

Finally, put breakpoints in the code and run `tilt up`.

### Errors with read-only file system

If you see an error like the following...

```shell
Error: EROFS: read-only file system, mkdir '/srv/app/.npm/_npx'
```

... it means that the `readOnlyRootFilesystem` protection on the snyk-monitor Helm Deployment causes issues with Tilt. This can be fixed by removing the `readOnlyRootFilesystem: true` value from the Helm chart located in `snyk-monitor/templates/deployment.yaml`.

### Cleaning up

Run `tilt down` to tear down the debugging session.
