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

circleci_get() {
  curl -s --fail --show-error \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "Circle-Token: $CIRCLE_TOKEN" \
    "https://circleci.com/api/v2/$1"
}

# This job runs minutes after prepare_to_deploy pushed to the deployer repo, so its pipeline and
# approval job may not exist yet. Wait for the approval job to be on hold before approving it.
ATTEMPTS=60
SLEEP_SECONDS=30
for ((i = 1; i <= ATTEMPTS; i++)); do
  PIPELINE_ID=$(circleci_get project/github/snyk/"${KUBERNETES_MONITOR_DEPLOYER_REPO}"/pipeline |
    jq -r --arg subject "${DEPLOY_SUBJECT}" 'first(.items[] | select(.vcs.commit.subject == $subject) | .id) // empty')
  if [ -n "${PIPELINE_ID}" ]; then
    WORKFLOW_ID=$(circleci_get pipeline/"${PIPELINE_ID}"/workflow | jq -r '.items[0].id // empty')
  fi
  if [ -n "${WORKFLOW_ID}" ]; then
    APPROVAL_REQUEST_ID=$(circleci_get workflow/"${WORKFLOW_ID}"/job |
      jq -r 'first(.items[] | select(.name == "Approve prod deployment" and .status == "on_hold") | .approval_request_id) // empty')
  fi
  if [ -n "${APPROVAL_REQUEST_ID}" ]; then
    break
  fi
  echo "attempt ${i}/${ATTEMPTS}: the prod approval for \"${DEPLOY_SUBJECT}\" is not on hold yet"
  sleep "${SLEEP_SECONDS}"
done

if [ -z "${APPROVAL_REQUEST_ID}" ]; then
  echo "Gave up waiting for the prod approval of \"${DEPLOY_SUBJECT}\" in the deployer repo." >&2
  exit 1
fi

APPROVAL=$(curl -s --fail --show-error \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  -X POST -d "{}" \
  https://circleci.com/api/v2/workflow/"${WORKFLOW_ID}"/approve/"${APPROVAL_REQUEST_ID}" | jq -r .message)

[[ ${APPROVAL} == "Accepted." ]] && echo "Approved Production deployment!"
