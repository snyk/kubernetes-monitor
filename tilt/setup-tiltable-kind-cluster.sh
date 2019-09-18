./kind create cluster --config=./test/fixtures/cluster-config.yaml --name=kind
export KUBECONFIG=`./kind get kubeconfig-path`
./kubectl create namespace snyk-monitor
./kubectl create secret generic snyk-monitor -n snyk-monitor --from-literal=dockercfg.json="{}" --from-literal=integrationId="41214617-cb5d-4674-8d97-5b456952c360"
echo '------------------------------------------------'
echo 'run "PATH=$PATH:./ tilt up" to start tilt'
echo "don't forget to set up KUBECONFIG"
echo 'clean up afterwards with "./kind delete cluster"'
