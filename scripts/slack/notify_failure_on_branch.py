#!/usr/bin/python3

import os
from notify_failure import notifySlack
import sys


def notifyOnBranch(branch_name: str, job_name: str, build_url: str, pr_url: str, slack_webhook: str):
    if branch_name == 'staging':
        notifySlack(branch_name, job_name, build_url, pr_url, slack_webhook)
    else:
        print('Current branch is ' + branch_name +
              ' so skipping notifying Slack')


if __name__ == '__main__':
    _, branch_name, job_name, build_url, pr_url, slack_webhook = sys.argv
    display_branch_name = sys.argv[1]
    notifyOnBranch(branch_name, job_name, build_url, pr_url, slack_webhook)
