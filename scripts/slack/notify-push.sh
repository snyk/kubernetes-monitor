#! /bin/bash

BRANCH_NAME="$1"
NOTIFICATION_COLOR=${2:-#7CD197}

curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "'$NOTIFICATION_COLOR'", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": "Kubernetes-Monitor Publish Notification", "text": ":egg_fancy: Published Kubernetes-Monitor: `'$BRANCH_NAME'` :egg_fancy:"}]}' $SLACK_WEBHOOK
