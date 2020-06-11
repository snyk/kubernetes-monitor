#!/usr/bin/python3

import sys
import os
import requests
import json

def notifySlack(from_version, to_version):
    circle_build_url = os.getenv('CIRCLE_BUILD_URL')
    url = os.getenv('SLACK_WEBHOOK')

    data = {
      'attachments': 
      [
        {
          'color': '#7CD197',
          'fallback': 'Build Notification: ' + circle_build_url,
          'title': 'Snyk Operator Upgrade Testing',
          'text': ':openshift: Successful upgrade from version ' + from_version + ' to version ' + to_version + ' :information_source:'
        }
      ]
    }

    requests.post(url, data=json.dumps(data))

if __name__ == '__main__':
    from_version = sys.argv[1]
    to_version = sys.argv[2]
    notifySlack(from_version, to_version)
