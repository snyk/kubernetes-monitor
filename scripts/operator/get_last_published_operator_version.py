#! /usr/bin/python3

import yaml
import requests
import re
import sys
import os
from sys import argv

def getLastOperatorVersion(url):
    resp = requests.get(url)
    yml = yaml.load(resp.text, Loader=yaml.SafeLoader)

    try:
        re_compile = re.compile("([1]\\.[0-9]{1,3}\\.[0-9]{1,3})")
        version = re_compile.search(yml["channels"][0]["currentCSV"]).group(0)
    except Exception as ex:
        print(
            "error: could not find version number for operator:",
            ex,
            file=sys.stderr,
        )
        os.exit(1)

    return version

if __name__ == '__main__':
    url = argv[1]
    print(getLastOperatorVersion(url))
