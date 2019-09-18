docker_build("snyk/kubernetes-monitor", ".",
  live_update=[
    fall_back_on(["package.json", "package-lock.json"]),
    sync('.', '/root'),
  ],
  entrypoint="bin/start-tilt"
)

allow_k8s_contexts(['minikube', 'kubernetes-admin@kind'])
k8s_yaml(local("helm template snyk-monitor | ./tilt/add-ns.py snyk-monitor"))
k8s_resource('snyk-monitor', port_forwards='9229:9229')
watch_file("snyk-monitor")


# vscode config:
#    {
#      "type": "node",
#      "request": "attach",
#      "name": "Attach to Remote",
#      "address": "127.0.0.1",
#      "port": 9229,
#      "localRoot": "${workspaceFolder}",
#      "remoteRoot": "/root"
#    }
