#! /usr/bin/python3

from tempfile import mkdtemp
from os import chmod, getcwd
from os.path import isfile
from datetime import datetime
from shutil import copy
from requests import get
from platform import system


def downloadOperatorSdk() -> None:
    cwd = getcwd()
    operator_sdk_path = cwd + "/" + "operator-sdk"
    if isfile(operator_sdk_path):
        print("Operator SDK is present locally")
        return

    current_sys = system()
    if current_sys == "Darwin":
        sdk = get(
            "https://github.com/operator-framework/operator-sdk/releases/download/v0.15.1/operator-sdk-v0.15.1-x86_64-apple-darwin")
    else:
        sdk = get(
            "https://github.com/operator-framework/operator-sdk/releases/download/v0.15.1/operator-sdk-v0.15.1-x86_64-linux-gnu")

    with open(operator_sdk_path, "wb") as f:
        f.write(sdk.content)
    chmod(operator_sdk_path, 0o744)


if __name__ == "__main__":
    downloadOperatorSdk()
