#!/bin/bash

# Download and install kubectl
echo "Downloading kubectl"
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/$(uname -s | awk '{print tolower($0)}')/amd64/kubectl
chmod +x kubectl
echo "Kubectl successfully installed!"

# Download and install KinD
echo "Downloading KinD"
curl -Lo kind https://github.com/kubernetes-sigs/kind/releases/download/v0.3.0/kind-$(uname -s | awk '{print tolower($0)}')-amd64
chmod +x kind 
echo "KinD successfully installed!"

# Create a new Kubernetes cluster using KinD
./kind create cluster --name="kind"
export KUBECONFIG="$(./kind get kubeconfig-path --name="kind")"
echo "Kubernetes ready!"

# Load test config file
SERVICE_ENV=test
cp config.${SERVICE_ENV}.json config.local.json

# Load egg into KinD cluster
docker build -t snyk-k8s-monitor:test --no-cache .
./kind load docker-image snyk-k8s-monitor:test
./kubectl create secret generic eggdockercfg \
  --from-file=.dockerconfigjson=$HOME/.docker/config.json \
  --type=kubernetes.io/dockerconfigjson

# Create test deployment yaml file
echo "Creating egg-test-deployment.yaml from egg-deployment.yaml"
node ./scripts/test-yaml-creator.js
if [[ -f "egg-test-deployment.yaml" ]]; then
  echo "egg-test-deployment.yaml created successfully"
fi

# Apply deployments
./kubectl apply -f egg-permissions.yaml
./kubectl apply -f egg-test-deployment.yaml
