#! /usr/bin/python3

from sys import argv
from create_operator import createOperatorAndBuildOperatorImage
from subprocess import call


def createOperatorAndPushToDockerHub(operator_tag: str, monitor_tag: str, dockerhub_user: str, dockerhub_password: str) -> None:
    operator_name_and_tag = "snyk/kubernetes-operator:" + operator_tag
    createOperatorAndBuildOperatorImage(operator_name_and_tag, monitor_tag)
    call(["docker", "login", "--username=" + dockerhub_user,
          "--password=" + dockerhub_password])
    call(["docker", "push", operator_name_and_tag])
    pass


if __name__ == '__main__':
    _, operator_tag, monitor_tag, dockerhub_user, dockerhub_password = argv
    createOperatorAndPushToDockerHub(
        operator_tag, monitor_tag, dockerhub_user, dockerhub_password)
