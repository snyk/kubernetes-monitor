#! /usr/bin/python3

from requests import post
from json import loads, dumps
from sys import argv


def getQuayToken(url, username, password) -> str:
    request = {"user": {"username": username, "password": password}}
    response = post(url, json=request, headers={
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    return loads(response.text)['token']


if __name__ == '__main__':
    _, username, password = argv
    quay_token = getQuayToken(
        "https://quay.io/cnr/api/v1/users/login",
        username,
        password
    )
    print(quay_token)
