#! /bin/bash
set -e

NEW_TAG=$1
echo About to update the gh-pages branch with new tag ${NEW_TAG}

echo configuring git
git config --global user.email "egg@snyk.io"
git config --global user.name "Runtime CI & CD"
git remote add origin-pages https://${GH_TOKEN}@github.com/snyk/kubernetes-monitor.git > /dev/null 2>&1
git checkout -f gh-pages

if grep -Fxq "  tag: ${NEW_TAG}" ./snyk-monitor/values.yaml
then
  echo not publishing a new gh-pages commit since this version is already published
  ./scripts/slack-notify-success-no-publish.sh
  exit 0
fi

echo overriding new yaml / chart files from master branch
git checkout origin/chore/publish_gh_pages -- snyk-monitor snyk-monitor-cluster-permissions.yaml snyk-monitor-deployment.yaml snyk-monitor-namespaced-permissions.yaml

echo overriding tag placeholders with latest semantic version
sed -i "s/{{IMAGE_TAG_OVERRIDE_WHEN_PUBLISHING}}/${NEW_TAG}/g" ./snyk-monitor/values.yaml
sed -i "s/{{IMAGE_TAG_OVERRIDE_WHEN_PUBLISHING}}/${NEW_TAG}/g" ./snyk-monitor-deployment.yaml

echo building new helm release
./helm init --client-only
./helm package snyk-monitor --version ${NEW_TAG}
./helm repo index .

echo publishing to gh-pages
git add index.yaml
git add snyk-monitor-${NEW_TAG}.tgz
git add ./snyk-monitor/values.yaml
git add ./snyk-monitor-deployment.yaml
COMMIT_MESSAGE='fix: :egg: Automatic Publish '${NEW_TAG}' :egg:'
git commit -m "${COMMIT_MESSAGE}"
git push --quiet --set-upstream origin-pages gh-pages
./scripts/slack-notify-push.sh "gh-pages"
