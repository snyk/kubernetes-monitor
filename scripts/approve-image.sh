#! /bin/bash

# $1 is the version from package.json
# if semantic release chooses not to release (only chores for example)
# then it would be null
if [ $1 == "null" ]; then
  echo Semantic-Release did not create a new version, not pushing a new approved image
  ./scripts/slack-notify-success-no-release.sh
else
  IMAGE_NAME_CANDIDATE=snyk/kubernetes-monitor:staging-candidate
  IMAGE_NAME_APPROVED=snyk/kubernetes-monitor:${1}-approved

  docker pull ${IMAGE_NAME_CANDIDATE} &&
  docker tag ${IMAGE_NAME_CANDIDATE} ${IMAGE_NAME_APPROVED} &&
  docker push ${IMAGE_NAME_APPROVED} &&
  ./scripts/slack-notify-push.sh ${IMAGE_NAME_APPROVED}
fi
