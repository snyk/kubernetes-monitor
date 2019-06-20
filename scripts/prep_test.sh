#!/bin/bash

# Download and install kubectl
if ! test -f ./kubectl; then
  echo "Downloading kubectl"
  curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/$(uname -s | awk '{print tolower($0)}')/amd64/kubectl
  chmod +x kubectl
  echo "Kubectl successfully installed!"
fi

# Download and install KinD
if ! test -f ./kind; then
  echo "Downloading KinD"
  curl -Lo kind https://github.com/kubernetes-sigs/kind/releases/download/v0.3.0/kind-$(uname -s | awk '{print tolower($0)}')-amd64
  chmod +x kind
  echo "KinD successfully installed!"
fi

# Create a new Kubernetes cluster using KinD
./kind create cluster --config="./scripts/cluster.yaml" --name="kind"
export KUBECONFIG="$(./kind get kubeconfig-path --name="kind")"
echo "Kubernetes ready!"

# Load test config file
SERVICE_ENV=test
cp config.${SERVICE_ENV}.json config.local.json

# Load snyk-monitor into KinD cluster
docker build -t snyk-k8s-monitor:test --no-cache .
./kind load docker-image snyk-k8s-monitor:test
./kubectl create namespace snyk-monitor
./kubectl create secret generic snyk-monitor -n snyk-monitor --from-literal=dockercfg.json="{}" --from-literal=integrationId="aaaabbbb-cccc-dddd-eeee-ffff11112222"

# Create test deployment yaml file
echo "Creating snyk-monitor-test-deployment.yaml from snyk-monitor-deployment.yaml"
node ./scripts/test-yaml-creator.js
if [[ -f "snyk-monitor-test-deployment.yaml" ]]; then
  echo "snyk-monitor-test-deployment.yaml created successfully"
fi

# Apply deployments
./kubectl apply -f snyk-monitor-permissions.yaml
./kubectl apply -f snyk-monitor-test-deployment.yaml
