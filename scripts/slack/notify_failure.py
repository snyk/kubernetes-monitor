#!/usr/bin/python3

import os
import requests
import json
import sys


def notifySlack(branch_name: str, job_name: str, build_url: str, pr_url: str, slack_webhook: str):
    job_name_message = 'Job name: `' + job_name + '`\n'
    build_url_message = 'Build URL: ' + build_url + '\n'
    pr_url_message = 'Pull request URL: ' + pr_url + '\n'
    message = ':egg_broken_1: Kubernetes-Monitor broken branch: `' + branch_name + \
        '` :egg_broken_1:\n' + job_name_message + build_url_message + pr_url_message

    data = {
        'attachments':
        [
            {
                'color': '#EE0000',
                'fallback': 'Build Notification: ' + build_url,
                'title': ':warning: Kubernetes-Monitor Merge Failure :warning:',
                'text': message
            }
        ]
    }

    requests.post(slack_webhook, data=json.dumps(data))


if __name__ == '__main__':
    _, branch_name, job_name, build_url, pr_url, slack_webhook = sys.argv
    notifySlack(branch_name, job_name, build_url, pr_url, slack_webhook)
