#! /bin/bash

DISPLAY_BRANCH_NAME="$1"

if [[ "$CIRCLE_BRANCH" == "staging" ]]; then
  ./scripts/slack/notify-failure.sh "$DISPLAY_BRANCH_NAME"
else
  echo "Current branch is $CIRCLE_BRANCH so skipping notifying Slack"
fi
