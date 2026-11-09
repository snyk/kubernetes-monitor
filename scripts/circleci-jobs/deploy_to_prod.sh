#! /bin/bash
set -e

# LATEST_TAG is the release cut at this commit, exported by the require_release_tag command.
DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLISHED_TAG=$("$DIR/published-chart-version.sh")
if [ "${PUBLISHED_TAG}" != "${LATEST_TAG}" ]; then
  echo "The published chart is ${PUBLISHED_TAG}, not ${LATEST_TAG}. Not deploying ${LATEST_TAG} to prod."
  circleci-agent step halt
  exit 0
fi

# prepare_to_deploy commits this subject to the deployer repo. Approve the pipeline for that
# commit, not the newest one, which can belong to a later release.
DEPLOY_SUBJECT="feat: deploy k-m v${LATEST_TAG}"
PIPELINE_ID=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  https://circleci.com/api/v2/project/github/snyk/"${KUBERNETES_MONITOR_DEPLOYER_REPO}"/pipeline |
  jq -r --arg subject "${DEPLOY_SUBJECT}" 'first(.items[] | select(.vcs.commit.subject == $subject) | .id) // empty')

if [ -z "${PIPELINE_ID}" ]; then
  echo "No deployer pipeline found for commit \"${DEPLOY_SUBJECT}\"." >&2
  exit 1
fi


WORKFLOW_ID=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  https://circleci.com/api/v2/pipeline/"${PIPELINE_ID}"/workflow | jq -r .items[0].id)

APPROVAL_REQUEST_ID=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  https://circleci.com/api/v2/workflow/"${WORKFLOW_ID}"/job | jq -r '.items[] | select(.name == "Approve prod deployment") | .approval_request_id')

APPROVAL=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  -X POST -d "{}" \
  https://circleci.com/api/v2/workflow/"${WORKFLOW_ID}"/approve/"${APPROVAL_REQUEST_ID}" | jq -r .message)

[[ ${APPROVAL} == "Accepted." ]] && echo "Approved Production deployment!"
