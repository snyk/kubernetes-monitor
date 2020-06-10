import yaml
import requests
import re
import sys
import os


OPERATOR_PACKAGE_YAML_PUBLISH_URL = "https://raw.githubusercontent.com/operator-framework/community-operators/master/community-operators/snyk-operator/snyk-operator.package.yaml"  # noqa: E501

resp = requests.get(OPERATOR_PACKAGE_YAML_PUBLISH_URL)
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

print(version)
