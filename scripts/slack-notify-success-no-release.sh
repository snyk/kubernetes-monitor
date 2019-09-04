#! /bin/bash
curl -X POST -H 'Content-Type:application/json' -d '{"attachments": [{"color": "warning", "fallback": "Build Notification: $TRAVIS_BUILD_WEB_URL", "title": "Kubernetes-Monitor Publish Notification", "text": ":egg_fancy: Successful `staging` merge, but no semantic-release occurring :egg_fancy:"}]}' $SLACK_WEBHOOK
