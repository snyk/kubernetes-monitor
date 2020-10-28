"""Delete all Operators from the Quay Snyk Operator repository

Args:
    username (str): Quay username
    password (str): Quay password
"""

from requests import get, delete
from json import loads
from get_quay_token import getQuayToken
from typing import List, Dict
from sys import argv

Package = Dict[str, object]


def getOperators(url: str) -> List[Package]:
    resp = get(url)
    return loads(resp.text)


def getVersions(packages: List[Package]) -> List[str]:
    def extract_version(package):
        return package["version"]

    return list(map(extract_version, packages))


def deleteOperator(quay_token: str, url: str) -> None:
    response = delete(url, headers={
        "Authorization": quay_token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    print(response.text)


if __name__ == '__main__':
    _, username, password = argv
    quay_token = getQuayToken(
        "https://quay.io/cnr/api/v1/users/login",
        username,
        password
    )

    operators = getOperators(
        "https://quay.io/cnr/api/v1/packages/snyk-runtime/snyk-operator"
    )
    versions = getVersions(operators)

    if len(versions) == 0:
        print("No Operators to delete")
    else:
        print("Deleting the following Operators:", ', '.join(versions))

    for version in versions:
        deleteOperator(
            quay_token,
            "https://quay.io/cnr/api/v1/packages/snyk-runtime/snyk-operator/" + version + "/helm"
        )
