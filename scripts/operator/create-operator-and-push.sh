#! /bin/bash

SNYK_MONITOR_IMAGE_TAG="$1"
SNYK_OPERATOR_IMAGE_NAME_AND_TAG="snyk/kubernetes-operator:${SNYK_MONITOR_IMAGE_TAG}"

./scripts/operator/create-operator.sh "${SNYK_OPERATOR_IMAGE_NAME_AND_TAG}" "${SNYK_MONITOR_IMAGE_TAG}"

docker login --username ${DOCKERHUB_USER} --password ${DOCKERHUB_PASSWORD}
docker push ${SNYK_OPERATOR_IMAGE_NAME_AND_TAG}
