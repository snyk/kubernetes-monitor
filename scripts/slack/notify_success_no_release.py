#!/usr/bin/python3

import os
import requests
import json

def notifySlack():
    circle_build_url = os.getenv('CIRCLE_BUILD_URL')
    url = os.getenv('SLACK_WEBHOOK')

    data = {
      'attachments': 
      [
        {
          'color': '#7CD197',
          'fallback': 'Build Notification: ' + circle_build_url,
          'title': 'Kubernetes-Monitor-Private-Fork Publish Notification',
          'text': ':fork_and_knife: Successful `staging` merge, but no semantic-release occurring :fork_and_knife:'
        }
      ]
    }

    requests.post(url, data=json.dumps(data))

if __name__ == '__main__':
    notifySlack()
