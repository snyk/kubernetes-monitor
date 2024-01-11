#! /bin/bash
set -e

PIPELINE_ID=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLI_CI_API_TOKEN" \
  https://circleci.com/api/v2/project/github/snyk/"${KUBERNETES_MONITOR_DEPLOYER_REPO}"/pipeline | jq -r .items[0].id)


WORKFLOW_ID=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLI_CI_API_TOKEN" \
  https://circleci.com/api/v2/pipeline/"${PIPELINE_ID}"/workflow | jq -r .items[0].id)

APPROVAL_REQUEST_ID=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLI_CI_API_TOKEN" \
  https://circleci.com/api/v2/workflow/"${WORKFLOW_ID}"/job | jq -r '.items[] | select(.name == "Approve prod deployment") | .approval_request_id')

APPROVAL=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLI_CI_API_TOKEN" \
  -X POST -d "{}" \
  https://circleci.com/api/v2/workflow/"${WORKFLOW_ID}"/approve/"${APPROVAL_REQUEST_ID}" | jq -r .message)

[[ ${APPROVAL} == "Accepted." ]] && echo "Approved Production deployment!"
