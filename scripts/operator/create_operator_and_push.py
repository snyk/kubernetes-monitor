from sys import argv
from create_operator import createOperatorAndBuildOperatorImage
from subprocess import call


def createOperatorAndPushToDockerHub(image_tag: str, dockerhub_user: str, dockerhub_password: str) -> None:
    operator_name_and_tag = "snyk/kubernetes-operator:" + image_tag
    createOperatorAndBuildOperatorImage(operator_name_and_tag, image_tag)
    call(["docker", "login", "--username=" + dockerhub_user,
          "--password=" + dockerhub_password])
    call(["docker", "push", operator_name_and_tag])
    pass


if __name__ == '__main__':
    _, image_tag, dockerhub_user, dockerhub_password = argv
    createOperatorAndPushToDockerHub(
        image_tag, dockerhub_user, dockerhub_password)
