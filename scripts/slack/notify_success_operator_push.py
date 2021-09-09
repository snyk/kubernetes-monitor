#!/usr/bin/python3

import sys
import os
import requests
import json

def notifySlack(operator_version, upstream_community, pr_url):
    circle_build_url = os.getenv('CIRCLE_BUILD_URL')
    url = os.getenv('SLACK_WEBHOOK')

    data = {
      'attachments':
      [
        {
          'color': '#7CD197',
          'fallback': 'Build Notification: ' + circle_build_url,
          'title': 'A new Snyk Operator has been pushed to ' + upstream_community,
          'text': 'A PR has been opened for branch *snyk/' + upstream_community + '/snyk-operator-v' + operator_version + '* on GitHub repo ' + upstream_community +' for ' + upstream_community + '.\n' + pr_url
        }
      ]
    }

    requests.post(url, data=json.dumps(data))

if __name__ == '__main__':
    operator_version = sys.argv[1]
    upstream_community = sys.argv[2]
    pr_url = sys.argv[3]
    notifySlack(operator_version, upstream_community, pr_url)
