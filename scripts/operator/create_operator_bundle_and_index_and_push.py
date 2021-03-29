#! /usr/bin/python3

from os import chdir, environ, getcwd
from subprocess import call
from shutil import copy
from sys import argv


def createOperatorBundleAndIndexAndPushToDockerHub(operator_path: str, new_operator_tag: str, dockerhub_user: str, dockerhub_password: str, previous_tag: str = None) -> None:
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

    if previous_tag == None:
        call([opm_copy_path, "index", "add", "-u", "docker", "--bundles", "docker.io/snyk/kubernetes-operator-bundle" +
             ":" + new_operator_tag, "--tag", "docker.io/snyk/kubernetes-operator-index" + ":" + new_operator_tag])
    else:
        call([opm_copy_path, "index", "add", "-u", "docker", "--mode", "semver", "--bundles", "docker.io/snyk/kubernetes-operator-bundle" + ":" + new_operator_tag,
             "--from-index", "docker.io/snyk/kubernetes-operator-index" + ":" + previous_tag, "--tag", "docker.io/snyk/kubernetes-operator-index" + ":" + new_operator_tag])
    call(["docker", "push", "snyk/kubernetes-operator-index" + ":" + new_operator_tag])
    chdir(return_dir)


if __name__ == '__main__':
    operator_path = argv[1]
    new_operator_tag = argv[2]
    dockerhub_user = argv[3]
    dockerhub_password = argv[4]
    previous_tag = argv[5] if len(argv) == 6 else None
    createOperatorBundleAndIndexAndPushToDockerHub(
        operator_path, new_operator_tag, dockerhub_user, dockerhub_password, previous_tag)
