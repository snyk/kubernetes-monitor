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
          'color': '#EE0000',
          'fallback': 'Build Notification: ' + circle_build_url,
          'title': ':warning: Kubernetes-Monitor Merge Failure :warning:',
          'text': ':egg_broken_1: Kubernetes-Monitor broken branch: `' + branch_name + '` :egg_broken_1:\n' + circle_build_url
        }
      ]
    }

    requests.post(url, data=json.dumps(data))

if __name__ == '__main__':
    branch_name = sys.argv[1]
    notifySlack(branch_name)
