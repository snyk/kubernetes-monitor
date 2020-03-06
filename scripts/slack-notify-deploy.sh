#! /bin/bash

IMAGE_NAME="$1"
DEPLOYMENT_ENVIRONMENT_NAME="$2"
NOTIFICATION_COLOR=${3:-#7CD197}

curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "'$NOTIFICATION_COLOR'", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": "Kubernetes-Monitor Deploy Notification", "text": ":hatching_chick: Deploying Kubernetes-Monitor on `'$DEPLOYMENT_ENVIRONMENT_NAME'`: `'$IMAGE_NAME'` :hatching_chick:"}]}' $SLACK_WEBHOOK
