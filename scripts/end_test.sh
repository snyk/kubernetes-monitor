#!/bin/bash

echo 'Test finished. Doing cleanup'
./kind delete cluster --name=kind
unset KUBECONFIG
rm snyk-monitor-test-deployment.yaml
rm ./kind 
rm ./kubectl
echo 'Test Done!'