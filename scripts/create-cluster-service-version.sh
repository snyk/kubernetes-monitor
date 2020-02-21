#! /bin/bash
#
# Creates a ClusterServiceVersion using Operator template files in this repository.
# The template files should have been previously generated by using the operator-sdk.
#
# This produces files ready to be tested and then published to OperatorHub to release
# a new version of the Snyk monitor (and accompanying Operator).
#

set -e

VERSION_TO_OVERRIDE_IN_CSV="$1"

PWD=$(pwd)
CSV_LOCATION="${PWD}/snyk-operator/deploy/olm-catalog/snyk-operator"
OPERATOR_PACKAGE_YALM_LOCATION="${CSV_LOCATION}/snyk-operator.package.yaml"

cp -r "${CSV_LOCATION}/0.0.0" "${CSV_LOCATION}/${VERSION_TO_OVERRIDE_IN_CSV}"

sed -i.bak "s|0.0.0|${VERSION_TO_OVERRIDE_IN_CSV}|g" "${OPERATOR_PACKAGE_YALM_LOCATION}"

SOURCE_CSV="${CSV_LOCATION}/${VERSION_TO_OVERRIDE_IN_CSV}/snyk-operator.v0.0.0.clusterserviceversion.yaml"
TARGET_CSV="${CSV_LOCATION}/${VERSION_TO_OVERRIDE_IN_CSV}/snyk-operator.v${VERSION_TO_OVERRIDE_IN_CSV}.clusterserviceversion.yaml"
mv "${SOURCE_CSV}" "${TARGET_CSV}"
sed -i.bak "s|0.0.0|${VERSION_TO_OVERRIDE_IN_CSV}|g" "${TARGET_CSV}"

# Check if the Operator files are valid
echo "ls ${CSV_LCATION}"
ls ${CSV_LOCATION}
echo "ls ${CSV_LCATION}/0.0.0"
ls "${CSV_LOCATION}/0.0.0"
echo "ls ${CSV_LCATION}/${VERSION_TO_OVERRIDE_IN_CSV}"
ls "${CSV_LOCATION}/${VERSION_TO_OVERRIDE_IN_CSV}"
pyenv global 3.5.2
pip3 install --upgrade pip
pip3 install operator-courier
cat "${CSV_LOCATION}/snyk-operator.package.yaml"
operator-courier verify --ui_validate_io ${CSV_LOCATION}
