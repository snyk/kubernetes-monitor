#! /bin/bash
set -e

# Getting latest released tag
LATEST_TAG_WITH_V=`git describe --abbrev=0 --tags ${CIRCLE_SHA1}`
LATEST_TAG=${LATEST_TAG_WITH_V:1}

# Config git
git config --global user.email "k-m@example.com"
git config --global user.name "K-M Deploy Bot"

# Pick the token. GH_TOKEN keeps precedence for compatibility. Contexts attached to this job can
# define GITHUB_TOKEN too, so DEPLOYER_GITHUB_TOKEN is available as an unambiguous name.
if [ -n "${DEPLOYER_GITHUB_TOKEN}" ]; then
  TOKEN_NAME=DEPLOYER_GITHUB_TOKEN
  RAW_TOKEN=${DEPLOYER_GITHUB_TOKEN}
elif [ -n "${GH_TOKEN}" ]; then
  TOKEN_NAME=GH_TOKEN
  RAW_TOKEN=${GH_TOKEN}
else
  TOKEN_NAME=GITHUB_TOKEN
  RAW_TOKEN=${GITHUB_TOKEN}
fi

# A token pasted into a CircleCI context can carry whitespace or a newline, which breaks a token
# embedded in a URL.
DEPLOYER_TOKEN=$(printf '%s' "${RAW_TOKEN}" | tr -d '[:space:]')
echo "Using the token from ${TOKEN_NAME} (${#DEPLOYER_TOKEN} characters, ${#RAW_TOKEN} before trimming whitespace)"
if [ -z "${DEPLOYER_TOKEN}" ]; then
  echo "No token found in DEPLOYER_GITHUB_TOKEN, GH_TOKEN or GITHUB_TOKEN." >&2
  exit 1
fi

# Send the token as a header instead of putting it in the URL: git drops credentials embedded in a
# URL when GitHub redirects the request, which surfaces as "could not read Username".
git config --global http.https://github.com/.extraheader \
  "Authorization: Basic $(printf 'x-access-token:%s' "${DEPLOYER_TOKEN}" | base64 -w0)"

# Clone repo
git clone https://github.com/snyk/$KUBERNETES_MONITOR_DEPLOYER_REPO.git

# Fail before doing any work if the token cannot push
if ! git -C $KUBERNETES_MONITOR_DEPLOYER_REPO push --dry-run origin HEAD:main; then
  echo "The token from ${TOKEN_NAME} cannot push to the deployer repo. Check it has Contents read/write on that repo." >&2
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
