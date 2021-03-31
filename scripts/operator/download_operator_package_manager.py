#! /usr/bin/python3

from os import chmod, getcwd, environ
from os.path import isfile
from requests import get
from platform import system


def downloadOperatorPackageManager() -> None:
    cwd = getcwd()
    operator_package_manager_path = cwd + "/" + "opm"
    if isfile(operator_package_manager_path):
        print("OPM is present locally")
        return

    try:
        opm_version = environ["OPM_VERSION"]
    except:
        opm_version = "v1.16.1"

    current_sys = system()
    if current_sys == "Darwin":
        opm = get(
            "https://github.com/operator-framework/operator-registry/releases/download/" + opm_version + "/darwin-amd64-opm")
    else:
        opm = get(
            "https://github.com/operator-framework/operator-registry/releases/download/" + opm_version + "/linux-amd64-opm")

    with open(operator_package_manager_path, "wb") as f:
        f.write(opm.content)
    chmod(operator_package_manager_path, 0o744)


if __name__ == "__main__":
    downloadOperatorPackageManager()
