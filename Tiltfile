docker_build("gcr.io/snyk-main/kubernetes-monitor", ".",
  live_update=[
    fall_back_on(["package.json", "package-lock.json"]),
    sync('.', '/src'),
  ]
)

k8s_yaml(local("helm template snyk-monitor"))
watch_file("snyk-monitor")
