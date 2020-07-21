#!/usr/bin/python3

import os
from github import Github
from get_last_published_operator_version import getLastOperatorVersion
import pr_resources

GITHUB_AUTOMATIC_OPERATOR_PRS_ACCESS_TOKEN = os.environ[
    'GITHUB_AUTOMATIC_OPERATOR_PRS_ACCESS_TOKEN']

github = Github(GITHUB_AUTOMATIC_OPERATOR_PRS_ACCESS_TOKEN)


def get_latest_operator_branch():
    repo = github.get_repo('snyk/community-operators')
    branches = repo.get_branches()

    return [branch.name for branch in branches if 'snyk-operator' in branch.name][-1]


def create_pull_request(new_operator_version, new_release_branch_name):
    user = github.get_user('operator-framework')
    repo = user.get_repo('community-operators')
    body = pr_resources.content

    pr = repo.create_pull(title='Upgrade snyk-operator to version ' + new_operator_version,
                          body=body,
                          base='master',
                          head='snyk:' + new_release_branch_name)

    pr.create_issue_comment(pr_resources.test_fail_info_comment)

    print('Raised a PR for operator version ' +
          new_operator_version + ': ' + pr.url)


if __name__ == '__main__':
    latest_published_operator_version = getLastOperatorVersion()
    print(
        'Latest published operator version: ' + latest_published_operator_version)
    new_operator_release_branch = get_latest_operator_branch()
    print(
        'Latest operator branch in snyk/community-operators: ' + new_operator_release_branch)
    new_operator_version = new_operator_release_branch.split('-v')[-1]
    print('Operator version to be released: ' + new_operator_version)
    if new_operator_version == latest_published_operator_version:
        print('No new operator versions to publish')
        os.exit(1)
    else:
        create_pull_request(new_operator_version, new_operator_release_branch)
