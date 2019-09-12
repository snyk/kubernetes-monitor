#! /bin/bash
curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "warning", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": "Kubernetes-Monitor Publish Notification", "text": ":egg: A new version is about to be published! :egg:\n'$CIRCLE_PULL_REQUEST'\nbranch of origin is `TODO`"}]}' $SLACK_WEBHOOK
