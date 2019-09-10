#! /bin/bash
curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "warning", "fallback": "Build Notification: '$CIRCLE_BUILD_URL'", "title": ":warning: Kubernetes-Monitor Merge Failure :warning:", "text": ":egg_broken_1: Kubernetes-Monitor broken branch: `'$1'` :egg_broken_1:"}]}' $SLACK_WEBHOOK
