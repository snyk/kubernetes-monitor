#! /usr/bin/python3

from os import chmod, getcwd
from os.path import isfile
from requests import get
from platform import system


def downloadOperatorPackageManager() -> None:
    cwd = getcwd()
    operator_package_manager_path = cwd + "/" + "opm"
    if isfile(operator_package_manager_path):
        print("OPM is present locally")
        return

    current_sys = system()
    if current_sys == "Darwin":
        opm = get(
            "https://github.com/operator-framework/operator-registry/releases/download/v1.16.1/darwin-amd64-opm")
    else:
        opm = get(
            "https://github.com/operator-framework/operator-registry/releases/download/v1.16.1/linux-amd64-opm")

    with open(operator_package_manager_path, "wb") as f:
        f.write(opm.content)
    chmod(operator_package_manager_path, 0o744)


if __name__ == "__main__":
    downloadOperatorPackageManager()
