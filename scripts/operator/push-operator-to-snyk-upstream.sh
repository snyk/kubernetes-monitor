#! /bin/bash
#
# Inputs:
# - $1: The current path (e.g. "./kubernetes-monitor" or $(pwd))
# - $2: The community folder that the operator will be pushed (e.g. 'community-operators' or 'upstream-community-operators')
#
# Outputs:
# - Push a new branch to snyk/community-operators
#
# Sync snyk/community-operators repo from framework-operator/community-operators repo.
# Push a new version of the Operator to the Snyk community-operators fork to publish it later.
# This branch will be ready to open a pull request to operator-framework community-operators repo.
#

set -xeo pipefail

CURRENT_DIRECTORY=$1 # pwd
COMMUNITY_REPO=$2 # community-operators(-prod)
COMMUNITY_OPERATORS_UPSTREAM_LOCATION="${CURRENT_DIRECTORY}/${COMMUNITY_REPO}" # pwd/community-operators(-prod)
DEPLOY_LOCATION="${COMMUNITY_OPERATORS_UPSTREAM_LOCATION}/operators" # pwd/community-operators(-prod)/operators

# Configure git user and gpg key
echo "${OPENSHIFT_OPERATOR_SIGNING_KEY_BASE64}" | base64 -d | gpg --import
git config --global commit.gpgsign true
git config --global user.signingkey "${OPENSHIFT_OPERATOR_SIGNING_KEY_ID}"
git config --global user.email "${OPENSHIFT_OPERATOR_GITHUB_EMAIL}"
git config --global user.name "${OPENSHIFT_OPERATOR_GITHUB_NAME}"

# Clone Community Operators repo from Snyk
git clone "https://github.com/snyk/${COMMUNITY_REPO}.git" $COMMUNITY_OPERATORS_UPSTREAM_LOCATION
cd "${COMMUNITY_OPERATORS_UPSTREAM_LOCATION}"

BRANCH_NAME=snyk/${COMMUNITY_REPO}/snyk-operator-v${NEW_OPERATOR_VERSION}
# Checkout branch for new snyk-operator version on community folder
git checkout -b $BRANCH_NAME

# Create location if it doesn't exist
mkdir -p  "${DEPLOY_LOCATION}/snyk-operator"

# Copy new release to branch
cp -r "${OPERATOR_PATH}/${NEW_OPERATOR_VERSION}" "${DEPLOY_LOCATION}/snyk-operator/."
cp "${OPERATOR_PATH}/snyk-operator.package.yaml" "${DEPLOY_LOCATION}/snyk-operator/."

# Create the signed commit and push
git add "${DEPLOY_LOCATION}/snyk-operator/*"
git commit -s -m "Upgrade snyk-operator to version ${NEW_OPERATOR_VERSION} in ${COMMUNITY_REPO}"
git push --set-upstream origin --force $BRANCH_NAME
