# snyk/kubernetes-monitor #

## Summary ##
Container to monitor Kubernetes clusters' security

## Running Locally ##
https://kubernetes.io/docs/tasks/tools/install-minikube/

```shell
kubectl run snyk-k8s-monitor --image-pull-policy=Never --image=snyk-k8s-monitor:latest
```

## Building with the provided .yaml files ##

You will first need a `dockercfg` file for configuring the monitor to be able to pull from a private registry.
Once you have the file, you can run the following to install the secret into k8s:
```shell
kubectl create secret generic eggdockercfg --from-file=config.json
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

Have a look at `egg-deployment.yaml` to see where the image is being pulled from.
If you would like to use a locally-built image, then modify the following lines like this:
```yaml
      containers:
      - image: <your-local-image-name:tag>
        imagePullPolicy: Never
```
