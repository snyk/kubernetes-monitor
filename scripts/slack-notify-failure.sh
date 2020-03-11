#! /bin/bash

BRANCH_NAME="$1"
NOTIFICATION_COLOR=${2:-#EE0000}

curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "'$NOTIFICATION_COLOR'", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": ":warning: Kubernetes-Monitor Merge Failure :warning:", "text": ":egg_broken_1: Kubernetes-Monitor broken branch: `'$BRANCH_NAME'` :egg_broken_1:\n'$CIRCLE_BUILD_URL'"}]}' $SLACK_WEBHOOK
