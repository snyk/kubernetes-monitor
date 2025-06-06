#! /bin/bash
set -e

# Getting latest released tag
LATEST_TAG_WITH_V=`git describe --abbrev=0 --tags ${CIRCLE_SHA1}`
LATEST_TAG=${LATEST_TAG_WITH_V:1}

# Config git
git config --global user.email "k-m@example.com"
git config --global user.name "K-M Deploy Bot"

# Clone repo
git clone https://$GH_TOKEN@github.com/snyk/$KUBERNETES_MONITOR_DEPLOYER_REPO.git

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
  tag: $LATEST_TAG

metadata:
  annotations:
    github.com/project-slug: snyk/kubernetes-monitor
    github.com/team-slug: snyk/infrasec_container
  labels:
    $SNYK_OWNER_LABEL_KEY: $SNYK_OWNER_LABEL_VALUE
    $SNYK_LOG_DEST_LABEL_KEY: $SNYK_LOG_DEST_LABEL_VALUE

EOF

# Add extra values
cat $KUBERNETES_MONITOR_DEPLOYER_REPO/extra-production-values.yaml >> $KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/$PRODUCTION_YAML_FILE_NAME.yaml

cd $KUBERNETES_MONITOR_DEPLOYER_REPO
git commit --allow-empty -am "feat: deploy k-m $LATEST_TAG_WITH_V"
git push origin main
