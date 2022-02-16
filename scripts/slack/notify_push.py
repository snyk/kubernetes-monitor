#!/usr/bin/python3

import os
import requests
import json
import sys

def notifySlack(branch_name):
    circle_build_url = os.getenv('CIRCLE_BUILD_URL')
    url = os.getenv('SLACK_WEBHOOK')

    data = {
      'attachments': 
      [
        {
          'color': '#7CD197',
          'fallback': 'Build Notification: ' + circle_build_url,
          'title': 'Kubernetes-Monitor-Private-Fork Publish Notification',
          'text': ':fork_and_knife: Published Kubernetes-Monitor-Private-Fork: `' + branch_name + '` :fork_and_knife:'
        }
      ]
    }

    requests.post(url, data=json.dumps(data))

if __name__ == '__main__':
    branch_name = sys.argv[1]
    notifySlack(branch_name)
