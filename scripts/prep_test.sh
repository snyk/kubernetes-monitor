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
./kind create cluster --config="./test/fixtures/cluster-config.yaml" --name="kind"
export KUBECONFIG="$(./kind get kubeconfig-path --name="kind")"
echo "Kubernetes ready!"

# Load snyk-monitor into KinD cluster
docker build -t snyk-k8s-monitor:test --no-cache .
./kind load docker-image snyk-k8s-monitor:test

# Create the necessary prerequisites for the snyk-monitor: the namespace and the secret
./kubectl create namespace snyk-monitor
./kubectl create secret generic snyk-monitor -n snyk-monitor --from-literal=dockercfg.json="{}" --from-literal=integrationId="aaaabbbb-cccc-dddd-eeee-ffff11112222"

# Add a sample workload to test against
echo "Deploying sample workloads"
# Create a separate namespace for the extra workloads
./kubectl create namespace services
./kubectl apply -f ./test/fixtures/alpine-pod.yaml
./kubectl apply -f ./test/fixtures/nginx-replicationcontroller.yaml
./kubectl apply -f ./test/fixtures/redis-deployment.yaml
echo "Deployed sample workloads!"

# Create test deployment yaml file from the original yaml file
echo "Creating snyk-monitor-test-deployment.yaml from snyk-monitor-deployment.yaml"
node ./scripts/test-yaml-creator.js
if [[ -f "snyk-monitor-test-deployment.yaml" ]]; then
  echo "snyk-monitor-test-deployment.yaml created successfully"
fi

# Run the snyk-monitor
./kubectl apply -f snyk-monitor-permissions.yaml
./kubectl apply -f snyk-monitor-test-deployment.yaml
echo "Deployed the snyk-monitor!"

# Wait for a while to pull the images and create the containers
echo "Napping for 2 minutes... Zzz"
sleep 120

POD_NAME=$(./kubectl get pod --all-namespaces | grep snyk-monitor- | cut -d' ' -f 4)
POD_LOGS=$(./kubectl logs --tail=11 -n snyk-monitor $POD_NAME)

EXPECTED_LOGS=$(cat ./test/fixtures/sample-output.txt)

if [[ "$POD_LOGS" == *"$EXPECTED_LOGS"* ]]; then
  echo "The snyk-monitor successfully scanned the workloads"
else
  echo "The snyk-monitor could not scan the workloads in the cluster!"
  echo $POD_LOGS
  exit 1
fi
