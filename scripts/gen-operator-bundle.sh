#!/bin/bash
#
# Create the Operator bundle using the command line tool operator-sdk.
# Because the bundle CSV file created is not full configured the script
# parse-operator-yaml is executed to make the adjustment in the CSV
#

SNYK_OPERATOR_IMAGE_NAME_AND_TAG="$1"
SNYK_MONITOR_IMAGE_TAG="$2"

PWD="$(pwd)"
OS_NAME="$(uname -s)"
OPERATOR_SDK_PATH=$([ "${OS_NAME}" == "Darwin" ] && echo "operator-sdk" || echo "${PWD}/operator-sdk")
PREVIOUS_IMAGE_TAG=0.0.0
OPERATOR_NAME=snyk-operator

# operator-sdk generate cvs just work with semantic version
regexp="^[0-9]+\.[0-9]+\.[0-9]+$"
if ! [[ $SNYK_MONITOR_IMAGE_TAG =~ $regexp ]];then
  SNYK_MONITOR_IMAGE_TAG=0.0.0
fi

echo "Operator name: ${OPERATOR_NAME}"
echo "Image tag: ${SNYK_MONITOR_IMAGE_TAG}"
echo "Previous image tag: ${PREVIOUS_IMAGE_TAG}"
echo "Current path: ${PWD}"

# Generate bundle via operator-sdk
regexp="${OPERATOR_NAME}"
if ! [[ $PWD =~ $regexp ]];then
  cd ${OPERATOR_NAME}
fi
${OPERATOR_SDK_PATH} generate csv --csv-channel=stable --csv-version=${SNYK_MONITOR_IMAGE_TAG} --default-channel=true --operator-name=${OPERATOR_NAME}
cd ..

# Copy the CRD file to bundle
cp  ${OPERATOR_NAME}/deploy/crds/charts.helm.k8s.io_snykmonitors_crd.yaml ${OPERATOR_NAME}/deploy/olm-catalog/${OPERATOR_NAME}/${SNYK_MONITOR_IMAGE_TAG}

# Update static fields in the bundle files
node ./scripts/parse-operator-yaml.js ${OPERATOR_NAME} ${SNYK_MONITOR_IMAGE_TAG} ${SNYK_OPERATOR_IMAGE_NAME_AND_TAG}