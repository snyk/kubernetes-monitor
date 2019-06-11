#! /bin/bash

# Constants:
RESOURCE_NAME=snyk-monitor
NAMESPACE_NAME=snyk-monitor

kubectl delete deployment -n $NAMESPACE_NAME $RESOURCE_NAME
kubectl delete clusterrolebinding $RESOURCE_NAME
kubectl delete serviceaccount -n $NAMESPACE_NAME $RESOURCE_NAME
kubectl delete clusterrole $RESOURCE_NAME
