#!/usr/bin/python3

import os
import subprocess

dockerhub_user = os.getenv('DOCKERHUB_USER')
dockerhub_password = os.getenv('DOCKERHUB_PASSWORD')

subprocess.getoutput("docker login --username " + dockerhub_user + " --password " + dockerhub_password)

circle_branch = os.getenv("CIRCLE_BRANCH")
if circle_branch == "staging":
    image_tag = "staging-candidate"
else:
    image_tag = "discardable"
circle_sha1 = os.getenv("CIRCLE_SHA1")
kubernetes_monitor_image_name_and_tag = "snyk/kubernetes-monitor:" + image_tag + "-" + circle_sha1

subprocess.getoutput("docker pull " + kubernetes_monitor_image_name_and_tag)

print(kubernetes_monitor_image_name_and_tag)
