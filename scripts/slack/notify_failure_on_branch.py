#!/usr/bin/python3

import os
from notify_failure import notifySlack
import sys

def notifyOnBranch(display_branch_name):
    circle_branch_name = os.getenv('CIRCLE_BRANCH')

    if circle_branch_name == 'staging':
        notifySlack(display_branch_name)
    else:
        print('Current branch is ' + circle_branch_name + ' so skipping notifying Slack')

if __name__ == '__main__':
    display_branch_name = sys.argv[1]
    notifyOnBranch(display_branch_name)
