#! /bin/bash
set -e

# Getting latest released tag
LATEST_TAG_WITH_V=`git describe --abbrev=0 --tags ${CIRCLE_SHA1}`
LATEST_TAG=${LATEST_TAG_WITH_V:1}

# Config git
git config --global user.email "k-m@example.com"
git config --global user.name "K-M Deploy Bot"

# The token needs Contents read/write on the deployer repo. Contexts attached to this job can also
# define GITHUB_TOKEN or GH_TOKEN, so prefer a name that nothing else sets.
if [ -n "${DEPLOYER_GITHUB_TOKEN}" ]; then
  TOKEN_NAME=DEPLOYER_GITHUB_TOKEN
  DEPLOYER_TOKEN=${DEPLOYER_GITHUB_TOKEN}
elif [ -n "${GITHUB_TOKEN}" ]; then
  TOKEN_NAME=GITHUB_TOKEN
  DEPLOYER_TOKEN=${GITHUB_TOKEN}
else
  TOKEN_NAME=GH_TOKEN
  DEPLOYER_TOKEN=${GH_TOKEN}
fi
echo "Pushing to the deployer repo with the token from ${TOKEN_NAME}"

# Clone repo
git clone https://${DEPLOYER_TOKEN}@github.com/snyk/$KUBERNETES_MONITOR_DEPLOYER_REPO.git

# Fail before doing any work if the token cannot push
if ! git -C $KUBERNETES_MONITOR_DEPLOYER_REPO push --dry-run origin HEAD:main; then
  echo "The token from ${TOKEN_NAME} cannot push to the deployer repo. Check it has Contents read/write on that repo and that no other attached context overrides ${TOKEN_NAME}." >&2
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
