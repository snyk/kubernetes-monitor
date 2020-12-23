# snyk-operator

```sh
curl -Lo opm https://github.com/operator-framework/operator-registry/releases/download/v1.15.3/darwin-amd64-opm
chmod +x opm
```

```sh
export VERSION=1.40.3
make docker-build
docker push <operator-repo>:$VERSION

make bundle-build
docker tag snyk/snyk-operator-bundle:$VERSION <red-hat-certification-repo>:$VERSION
docker push <red-hat-certification-repo>:$VERSION

./opm index add -c docker --bundles snyk/snyk-operator-bundle:$VERSION --tag snyk/snyk-operator-index:$VERSION
```

```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: snyk-operator
  namespace: openshift-marketplace
spec:
  sourceType: grpc
  image: docker.io/snyk/snyk-operator-index:1.40.3-pre5
  displayName: Snyk Operator Bundle
  publisher: Snyk Ltd.
  updateStrategy:
    registryPoll:
      interval: 1m
```

```yaml
apiVersion: charts.snyk.io/v1alpha1 # this has changed, used to be "charts.helm.k8s.io/v1alpha1"
kind: SnykMonitor
metadata:
  name: snyk-monitor
  namespace: snyk-monitor
spec:
  integrationApi: https://kubernetes-upstream.dev.snyk.io
  temporaryStorageSize: 20Gi
  pvc:
    enabled: true
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: snyk-operator
  namespace: snyk-monitor
spec:
  targetNamespaces:
    - snyk-monitor
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: snyk-operator
  namespace: snyk-monitor
spec:
  channel: stable
  name: snyk-operator-certified # this has changed, used to be "snyk-operator"
  installPlanApproval: Automatic
  source: snyk-operator
  sourceNamespace: openshift-marketplace
```
