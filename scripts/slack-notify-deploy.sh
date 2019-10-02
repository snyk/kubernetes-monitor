#! /bin/bash
curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "warning", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": "Kubernetes-Monitor Deploy Notification", "text": ":hatching_chick: Deploying Kubernetes-Monitor on `'$2'`: `'$1'` :hatching_chick:"}]}' $SLACK_WEBHOOK
