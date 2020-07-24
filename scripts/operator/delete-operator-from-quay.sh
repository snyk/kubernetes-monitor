#! /bin/bash

set -e

QUAY_TOKEN=$(curl -H "Content-Type: application/json" -XPOST https://quay.io/cnr/api/v1/users/login -d "{\"user\": {\"username\": \"${QUAY_USERNAME}\", \"password\": \"${QUAY_PASSWORD}\"}}" | jq -r .token)
OPERATOR_VERSION="0.0.1-2a4e062254ca15ea4f476ccfde33a5219881d7e6"

STATUSCODE=$( curl --silent --output /dev/stderr --write-out "%{http_code}" -XDELETE -H "Accept: application/json" -H "Content-Type: application/json" -H "Authorization: $QUAY_TOKEN" "https://quay.io/cnr/api/v1/packages/snyk-runtime/snyk-operator/${OPERATOR_VERSION}/helm" )

if test $STATUSCODE -ge 300; then
  echo "Unexpected status code $STATUSCODE"
  exit 1
fi
