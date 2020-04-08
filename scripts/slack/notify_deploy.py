#!/usr/bin/python3

import os
import requests
import json
import sys


def notifySlack(image_name, deployment_env_name):
    circle_build_url = os.getenv('CIRCLE_BUILD_URL')
    url = os.getenv('SLACK_WEBHOOK')

    data = {
        'attachments':
        [
            {
                'color': '#7CD197',
                'fallback': 'Build Notification: ' + circle_build_url,
                'title': 'Kubernetes-Monitor Deploy Notification',
                'text': ':hatching_chick: Deploying Kubernetes-Monitor on `' + deployment_env_name + '`: `' + image_name + '` :hatching_chick:'
            }
        ]
    }

    requests.post(url, data=json.dumps(data))


if __name__ == '__main__':
    image_name = sys.argv[1]
    deployment_env_name = sys.argv[2]
    notifySlack(image_name, deployment_env_name)
