#! /usr/bin/python3

from os import chdir, environ, getcwd
from subprocess import call
from shutil import copy
from sys import argv


def createOperatorBundleAndIndexAndPushToDockerHub(operator_path: str, new_operator_tag: str, dockerhub_user: str, dockerhub_password: str) -> None:
    current_dir = getcwd()
    opm_copy_path = operator_path + "/" + "certified-operator/opm"
    copy(current_dir + "/" + "opm", opm_copy_path)

    call(["docker", "login", "--username=" + dockerhub_user,
          "--password=" + dockerhub_password])

    return_dir = current_dir
    chdir(operator_path + "/" + "certified-operator")
    print(operator_path + "/" + "certified-operator")
    environ['VERSION'] = new_operator_tag
    call(["make", "bundle-build"])
    call(["docker", "push", "snyk/kubernetes-operator-bundle" + ":" + new_operator_tag])

    call([opm_copy_path, "index", "add", "-c", "docker", "--bundles", "snyk/kubernetes-operator-bundle" +
          ":" + new_operator_tag, "--tag", "snyk/kubernetes-operator-index" + ":" + new_operator_tag])
    call(["docker", "push", "snyk/kubernetes-operator-index" + ":" + new_operator_tag])
    chdir(return_dir)


if __name__ == '__main__':
    _, operator_path, new_operator_tag, dockerhub_user, dockerhub_password = argv
    createOperatorBundleAndIndexAndPushToDockerHub(
        operator_path, new_operator_tag, dockerhub_user, dockerhub_password)
