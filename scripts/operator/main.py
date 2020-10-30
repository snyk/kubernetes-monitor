"""Set up a local OpenShift environment

Does the following steps:
- build an Operator image and push to DockerHub
- package an Operator bundle and push to Quay

PREREQUISITES:
The following environment variables:
- QUAY_USERNAME
- QUAY_PASSWORD
- DOCKERHUB_USER (to push the Operator image)
- DOCKERHUB_PASSWORD
"""

from os import environ
from hashlib import sha1
from datetime import datetime
from subprocess import call
from get_quay_token import getQuayToken
from create_operator_and_push import createOperatorAndPushToDockerHub
from package_operator_bundle import createOperatorFromTemplate
from upload_operator_bundle_to_quay import uploadOperatorBundleToQuay
from download_operator_sdk import downloadOperatorSdk


if __name__ == '__main__':
    random_digest = sha1(str(datetime.now()).encode("utf-8")).hexdigest()
    operator_version = "0.0.1-" + random_digest

    try:
        new_monitor_tag = environ['KUBERNETES_MONITOR_IMAGE_TAG']
    except:
        print("Missing environment variable KUBERNETES_MONITOR_IMAGE_TAG")
        print("Building kubernetes-monitor image and pushing to DockerHub")
        new_monitor_tag = operator_version
        monitor_name_and_tag = "snyk/kubernetes-monitor:" + new_monitor_tag
        call(["docker", "build", "-t", monitor_name_and_tag, "."])
        call(["docker", "push", monitor_name_and_tag])

    print("Authenticating to Quay")
    quay_username = environ['QUAY_USERNAME']
    quay_password = environ['QUAY_PASSWORD']
    quay_token = getQuayToken(
        "https://quay.io/cnr/api/v1/users/login",
        quay_username,
        quay_password
    )

    print("Downloading Operator SDK")
    downloadOperatorSdk()
    call(["pip3", "install", "operator-courier==2.1.7"])

    print("Creating Operator image and pushing to DockerHub")
    dockerhub_user = environ['DOCKERHUB_USER']
    dockerhub_password = environ['DOCKERHUB_PASSWORD']
    createOperatorAndPushToDockerHub(
        operator_version, new_monitor_tag, dockerhub_user, dockerhub_password)

    new_version = new_operator_tag = operator_version

    print("Creating Operator bundle")
    operator_path = createOperatorFromTemplate(
        operator_version, new_operator_tag, new_monitor_tag)
    print("Pushing Operator bundle to Quay")
    uploadOperatorBundleToQuay(
        operator_path, "snyk-runtime-local", "snyk-operator", operator_version, quay_token)
    print("Operator version " + operator_version + " has been pushed to Quay")
