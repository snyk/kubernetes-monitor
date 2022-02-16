docker_build("snyk/kubernetes-monitor", ".",
  live_update=[
    fall_back_on(["package.json", "package-lock.json"]),
    sync('.', '/srv/app'),
  ],
  entrypoint="bin/start-tilt"
)

allow_k8s_contexts(['minikube', 'kubernetes-admin@kind'])
yaml = helm(
  'snyk-monitor',
  namespace='snyk-monitor',
  )
k8s_yaml(yaml)
k8s_resource('snyk-monitor', port_forwards='9229:9229')

# vscode config:
#    {
#      "type": "node",
#      "request": "attach",
#      "name": "Attach to Remote",
#      "address": "127.0.0.1",
#      "port": 9229,
#      "localRoot": "${workspaceFolder}",
#      "remoteRoot": "/srv/app"
#    }
