#! /usr/bin/python3

from subprocess import call
from sys import argv


def uploadOperatorBundleToQuay(operator_dir: str, quay_namespace: str, package_name: str, package_version: str, quay_token: str) -> None:
    call(["operator-courier", "push", operator_dir, quay_namespace,
          package_name, package_version, quay_token])


if __name__ == '__main__':
    _, operator_dir, quay_namespace, package_name, package_version, quay_token = argv
    uploadOperatorBundleToQuay(
        operator_dir, quay_namespace, package_name, package_version, quay_token)
