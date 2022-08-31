#! /bin/bash
set -e

# Getting latest released tag
LATEST_TAG_WITH_V=`git describe --abbrev=0 --tags ${CIRCLE_SHA1}`
LATEST_TAG=${LATEST_TAG_WITH_V:1}
LATEST_TAG_APPROVED=${LATEST_TAG}-approved

# Send Slack notification
./scripts/slack/notify_deploy.py $LATEST_TAG_APPROVED dev

# Config git
git config --global user.email "k-m@example.com"
git config --global user.name "K-M Deploy Boy"

git clone https://$GH_TOKEN@github.com/snyk/$KUBERNETES_MONITOR_DEPLOYER_REPO.git

cp -r snyk-monitor/* $KUBERNETES_MONITOR_DEPLOYER_REPO/helm

# Create helm values for different envs
cat >$KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/pre-prod-mt.yaml <<EOF
clusterName: "Development cluster"
integrationApi: https://kubernetes-upstream.dev.snyk.io
log_level: "DEBUG"
skip_k8s_jobs: true

policyOrgs:
  - $POLICY_ORG_PRE_PROD

image:
  tag: $LATEST_TAG_APPROVED

skopeo:
  compression:
    level: 1

workers:
  count: 5

EOF

cat >$KUBERNETES_MONITOR_DEPLOYER_REPO/helm/values/prod-mt.yaml <<EOF
clusterName: "Production cluster"
log_level: "DEBUG"
skip_k8s_jobs: true

limit:
  memory: "4Gi"

policyOrgs:
  - $POLICY_ORG_PROD

image:
  tag: $LATEST_TAG

skopeo:
  compression:
    level: 1

workers:
  count: 5

EOF

cd $KUBERNETES_MONITOR_DEPLOYER_REPO
git commit --allow-empty -am "feat: deploy k-m $LATEST_TAG_WITH_V"
git push origin main
