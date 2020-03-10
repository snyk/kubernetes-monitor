# snyk/kubernetes-operator #

## Summary ##

An Operator that controls the deployment of the Snyk controller.

## Building the Operator ##

The Operator is created from templated files in order to avoid running `operator-sdk` for every new version that needs to be released.

Use `scripts/create-operator.sh` and `scripts/package-operator.sh` to build a new Operator image and to create an Operator bundle. If running on Mac, install the SDK with `brew install operator-sdk`. If running on Linux, place the `operator-sdk` binary in the root of the `snyk/kubernetes-monitor` repository.

## Changing the Operator ##

Changes to the Operator should be performed on the templated files located under `snyk-operator/deploy/olm-catalog/snyk-operator`.
