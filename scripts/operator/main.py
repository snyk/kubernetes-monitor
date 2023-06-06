#! /usr/bin/python3

"""Set up a local OpenShift environment

Does the following steps:
- build an Operator image and push to DockerHub
- package an Operator bundle and push to Quay

PREREQUISITES:
The following environment variables:
- DOCKERHUB_USER (to push the Operator image)
- DOCKERHUB_PASSWORD
"""

from os import environ, remove, getcwd
from hashlib import sha1
from datetime import datetime
from subprocess import call
from download_operator_package_manager import downloadOperatorPackageManager
from create_operator_and_push import createOperatorAndPushToDockerHub
from package_operator_bundle import createOperatorFromTemplate
from download_operator_sdk import downloadOperatorSdk
from create_operator_bundle_and_index_and_push import createOperatorBundleAndIndexAndPushToDockerHub

if __name__ == '__main__':
    random_digest = sha1(str(datetime.now()).encode("utf-8")).hexdigest()
    operator_version = "0.0.1-ubi9-" + random_digest[0:8]

    with open(getcwd() + "/" + ".operator_version", "w") as f:
        f.write(operator_version)

    try:
        new_monitor_tag = environ['KUBERNETES_MONITOR_IMAGE_TAG']
    except:
        print("Missing environment variable KUBERNETES_MONITOR_IMAGE_TAG")
        print("Building kubernetes-monitor image and pushing to DockerHub")
        new_monitor_tag = operator_version
        monitor_name_and_tag = "snyk/kubernetes-monitor:" + new_monitor_tag
        call(["docker", "build", "-t", monitor_name_and_tag, "."])
        call(["docker", "push", monitor_name_and_tag])

    print("Downloading Operator SDK")
    downloadOperatorSdk()
    print("Downloading Operator Package Manager")
    downloadOperatorPackageManager()

    print("Creating Operator image and pushing to DockerHub")
    dockerhub_user = environ['DOCKERHUB_USER']
    dockerhub_password = environ['DOCKERHUB_PASSWORD']
    createOperatorAndPushToDockerHub(
        operator_version, new_monitor_tag, dockerhub_user, dockerhub_password)

    new_operator_tag = operator_version

    print("Creating Operator bundle")
    operator_path = createOperatorFromTemplate(
        operator_version, new_operator_tag, new_monitor_tag)
    print("Pushing Operator bundle")
    createOperatorBundleAndIndexAndPushToDockerHub(
        operator_path, new_operator_tag, dockerhub_user, dockerhub_password)
    print("Operator version " + operator_version +
          " has been pushed to Docker Hub")

    remove("operator-sdk")
    remove("opm")
