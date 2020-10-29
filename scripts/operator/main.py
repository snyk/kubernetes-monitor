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
from get_quay_token import getQuayToken
from create_operator_and_push import createOperatorAndPushToDockerHub
from package_operator_bundle import createOperatorFromTemplate
from upload_operator_bundle_to_quay import uploadOperatorBundleToQuay

if __name__ == '__main__':
    random_digest = sha1(str(datetime.now()).encode("utf-8")).hexdigest()
    operator_version = "0.0.1-" + random_digest

    quay_username = environ['QUAY_USERNAME']
    quay_password = environ['QUAY_PASSWORD']
    quay_token = getQuayToken(
        "https://quay.io/cnr/api/v1/users/login",
        quay_username,
        quay_password
    )

    dockerhub_user = environ['DOCKERHUB_USER']
    dockerhub_password = environ['DOCKERHUB_PASSWORD']
    createOperatorAndPushToDockerHub(
        operator_version, dockerhub_user, dockerhub_password)

    new_version = new_operator_tag = new_monitor_tag = operator_version
    operator_path = createOperatorFromTemplate(
        operator_version, new_operator_tag, new_monitor_tag)
    uploadOperatorBundleToQuay(
        operator_path, "snyk-runtime-local", "snyk-operator", operator_version, quay_token)
    print("Operator version " + operator_version + "has been pushed to Quay")
