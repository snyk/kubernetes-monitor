#! /bin/bash
set -e

# Getting latest released tag
LATEST_TAG_WITH_V=`git describe --abbrev=0 --tags ${CIRCLE_SHA1}`
LATEST_TAG=${LATEST_TAG_WITH_V:1}-approved

# Send Slack notification
./scripts/slack/notify_deploy.py $LATEST_TAG dev

# Deploy to pre-prod
git clone https://$GH_TOKEN@github.com/snyk/$KUBERNETES_MONITOR_DEPLOYER_REPO.git
mkdir -p $KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/
cat >$KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/pre-prod-mt.yaml <<EOF
clusterName: "Development cluster"
integrationApi: https://kubernetes-upstream.dev.snyk.io
log_level: "DEBUG"
skip_k8s_jobs: true

policyOrgs:
  - $POLICY_ORG_PRE_PROD

image:
  tag: $LATEST_TAG

skopeo:
  compression:
    level: 1

workers:
  count: 5

EOF
cd $KUBERNETES_MONITOR_DEPLOYER_REPO &&
git commit -am "feat: deploy to dev k-m $LATEST_TAG_WITH_V" &&
git push origin main
