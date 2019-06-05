# snyk/kubernetes-monitor #

## Summary ##
Container to monitor Kubernetes clusters' security

## Running Locally ##
https://kubernetes.io/docs/tasks/tools/install-minikube/

```shell
kubectl run snyk-k8s-monitor --image-pull-policy=Never --image=snyk-k8s-monitor:latest
```

## Building with the provided .yaml files ##

You can execute the following commands from the root project folder:
```shell
docker build -t snyk-k8s-monitor --rm .
```

Then you can apply the "permissions" -- basically creating the Service Account with constrained permissions.
```shell
kubectl apply -f egg-permissions.yaml
```

And finally, to start the container:

```shell
kubectl apply -f egg-deployment.yaml
```
The above command applies a whole deployment.
