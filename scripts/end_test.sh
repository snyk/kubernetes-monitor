#!/bin/bash

echo 'Test finished. Doing cleanup'
./kind delete cluster --name=kind
unset KUBECONFIG
rm egg-test-deployment.yaml
rm ./kind 
rm ./kubectl
echo 'Test Done!'