#! /bin/bash
set -e

# Getting latest released tag
LATEST_TAG_WITH_V=`git describe --abbrev=0 --tags ${CIRCLE_SHA1}`
LATEST_TAG=${LATEST_TAG_WITH_V:1}

# Config git
git config --global user.email "k-m@example.com"
git config --global user.name "K-M Deploy Bot"

# Git drops a token embedded in the clone URL when it rewrites the remote, then prompts for a
# username. Send the same token as a Bearer header, which is what GitHub documents for token
# auth. GH_TOKEN wins when both are set.
AUTH_TOKEN=${GH_TOKEN:-$GITHUB_TOKEN}
if [ -z "${AUTH_TOKEN}" ]; then
  echo "No token found in GH_TOKEN or GITHUB_TOKEN." >&2
  exit 1
fi
git config --global http.https://github.com/.extraheader "Authorization: Bearer ${AUTH_TOKEN}"

# CircleCI can rewrite https://github.com to the checkout SSH key. The config key and
# file vary, so unsetting one entry is not enough. Git picks the longest insteadOf
# match: pin this repo's own URL back to HTTPS so the rewrite loses.
echo "Git URL rewrites:"
git config --show-origin --get-regexp '^url\..*\.insteadof$' || echo "(none)"
DEPLOYER_URL="https://github.com/snyk/${KUBERNETES_MONITOR_DEPLOYER_REPO}.git"
git config --global url."${DEPLOYER_URL}".insteadOf "${DEPLOYER_URL}"

# Clone repo
git clone "$DEPLOYER_URL"

if ! git -C $KUBERNETES_MONITOR_DEPLOYER_REPO push --dry-run origin HEAD:main; then
  echo "The token cannot push to the deployer repo. It needs Contents read and write on that repo." >&2
  exit 1
fi

# Copy contents from snyk-monitor/ folder into deployer helm/ folder in github
cp -r snyk-monitor/* $KUBERNETES_MONITOR_DEPLOYER_REPO/helm 

# Replace Chart.yaml with the Chart.yaml from the deployer repo
cat $KUBERNETES_MONITOR_DEPLOYER_REPO/Chart.yaml > $KUBERNETES_MONITOR_DEPLOYER_REPO/helm/Chart.yaml

# Create environment values file(s)
cat >$KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/$PRODUCTION_YAML_FILE_NAME.yaml <<EOF
clusterName: "Production cluster"

policyOrgs:
  - $POLICY_ORG_PROD

image:
  repository: us-docker.pkg.dev/polaris-gcp-gar/polaris/kubernetes-monitor
  tag: $LATEST_TAG
  releaseTag: $LATEST_TAG

metadata:
  annotations:
    github.com/project-slug: snyk/kubernetes-monitor
    github.com/team-slug: snyk/engines_sca-scanners
  labels:
    $SNYK_OWNER_LABEL_KEY: $SNYK_OWNER_LABEL_VALUE
    $SNYK_LOG_DEST_LABEL_KEY: $SNYK_LOG_DEST_LABEL_VALUE
    snykappname: snyk-monitor
    snykdclstored: 2-confidential
    snykdclprocessed: 2-confidential
    snykowner: sca-scanners

EOF

# Add extra values
cat $KUBERNETES_MONITOR_DEPLOYER_REPO/extra-production-values.yaml >> $KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/$PRODUCTION_YAML_FILE_NAME.yaml

cd $KUBERNETES_MONITOR_DEPLOYER_REPO
git commit --allow-empty -am "feat: deploy k-m $LATEST_TAG_WITH_V"
git push origin main
