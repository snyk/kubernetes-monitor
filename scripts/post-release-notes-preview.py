#!/usr/local/bin/python3

import os
import requests
import subprocess
import sys

BRANCH_PREFIXES_TO_POST = ['feat', 'fix', 'chore', 'test', 'docs', 'revert']
GIT_ORG = os.environ['CIRCLE_PROJECT_USERNAME']
GIT_REPO = os.environ['CIRCLE_PROJECT_REPONAME']
GIT_BRANCH = os.environ['CIRCLE_BRANCH']
gitBranchParts = GIT_BRANCH.split('/')
if len(gitBranchParts) <= 1:
    sys.exit(0)

gitBranchPrefix = gitBranchParts[0]
if not gitBranchPrefix in BRANCH_PREFIXES_TO_POST:
    sys.exit(0)

def main():
    # last version:
    lastVersion = subprocess.check_output(['git', 'describe', '--abbrev=0', '--tags', 'origin/staging'], text=True).strip()

    # commits since last version
    commitsSinceLastVersion = subprocess.check_output(['git', 'log', '--no-decorate', lastVersion + '..HEAD', '--oneline'], text=True).strip()
    commits = processCommits(commitsSinceLastVersion)

    if not (commits['features'] or commits['fixes']):
        sys.exit(0)

    pullRequestUrls = os.environ.get('CIRCLE_PULL_REQUESTS', '')
    if not pullRequestUrls:
        sys.exit(0)

    # TODO: support multiple PRs
    pullRequestUrl = pullRequestUrls.split(',')[0]
    pullRequestNumber = pullRequestUrl.split('/')[-1]
    # TODO error handling
    pullRequest = requests.get('https://api.github.com/repos/{org}/{repo}/pulls/{pr}'.format(org=GIT_ORG,repo=GIT_REPO,pr=pullRequestNumber))
    issue = pullRequest.json()['_links']['issue']

    textToPost = getTextToPost(commits)
    comment = '*{title}*\n{body}'.format(**textToPost)

    headers = {'Authorization': 'token ' + os.environ['GITHUB_TOKEN']}
    # TODO what if we get an error?
    requests.post(
        '%s/comments' % issue['href'],
        json={'body': comment},
        headers=headers,
    )

def processCommits(commitsSinceLastVersion):
    # TODO: handle reverts?
    commits = {
        "features": [],
        "fixes": [],
        "others": [],
    }

    lines = commitsSinceLastVersion.split('\n')
    for line in lines:
        words = line.split(' ')
        hash = words[0]
        prefix = words[1]
        rest = ' '.join(words[2:])

        title = ''.join(rest) + ' (%s)' % hash
        if prefix == 'feat:':
            commits['features'].append(title)
        elif prefix == 'fix:':
            commits['fixes'].append(title)
        else:
            commits['others'].append(title)
    
    return commits

def getTextToPost(commits):
    USERNAME = os.environ.get('CIRCLE_USERNAME', 'USER_NOT_FOUND')
    textToPost = {
        'title': 'Expected release notes (by @%s)' % USERNAME,
        'body': '',
    }

    if commits['features']:
        textToPost['body'] += '\nfeatures:\n' + '\n'.join(commits['features'])
    if commits['fixes']:
        textToPost['body'] += '\n\nfixes:\n' + '\n'.join(commits['fixes'])
    if commits['others']:
        textToPost['body'] += '\n\nothers (will not be included in Semantic-Release notes):\n' + '\n'.join(commits['others'])

    return textToPost

if __name__ == '__main__':
    main()
