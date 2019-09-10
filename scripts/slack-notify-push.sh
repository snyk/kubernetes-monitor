#! /bin/bash
curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "warning", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": "Kubernetes-Monitor Publish Notification", "text": ":egg_fancy: Published Kubernetes-Monitor: `'$1'` :egg_fancy:"}]}' $SLACK_WEBHOOK
