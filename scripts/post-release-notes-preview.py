import json
import os
import requests
import subprocess
import sys

eventName = os.environ['GITHUB_EVENT_NAME']
if eventName != 'pull_request':
    sys.exit(0)

eventPath = os.environ['GITHUB_EVENT_PATH']
with open(eventPath) as f:
    eventData = json.loads(f.read())

GIT_OWNER_AND_REPO = os.environ['GITHUB_REPOSITORY']

def main():
    pullRequestNumber = eventData['number']

    headers = {'Authorization': 'token ' + os.environ['GITHUB_TOKEN']}
    # TODO error handling
    pullRequest = requests.get('https://api.github.com/repos/{orgAndRepo}/pulls/{pr}'.format(orgAndRepo=GIT_OWNER_AND_REPO, pr=pullRequestNumber))
    issue = pullRequest.json()['_links']['issue']

    # get all existing comments for this issue/PR
    allCommentsResponse = requests.get(
        '%s/comments' % issue['href'],
        headers=headers,
    ).json()
    commentIds = [
        comment['id'] for comment in allCommentsResponse
        if comment['user']['login'] == 'snyk-deployer'
        and comment['user']['id'] == 18642669
        and 'Expected release notes' in comment['body']
    ]

    # delete old & irrelevant release notes previews
    for id in commentIds:
        requests.delete(
            'https://api.github.com/repos/{orgAndRepo}/issues/comments/{commentId}'.format(orgAndRepo=GIT_OWNER_AND_REPO, commentId=id),
            headers=headers,
        )

    lastVersion = subprocess.check_output(['git', 'describe', '--abbrev=0', '--tags', 'origin/staging'], text=True, stderr=subprocess.STDOUT).strip()
    commitsSinceLastVersion = subprocess.check_output(['git', 'log', '--no-decorate', lastVersion + '..HEAD', '--oneline'], text=True).strip()
    commits = processCommits(commitsSinceLastVersion)
    if not (commits['features'] or commits['fixes']):
        sys.exit(0)

    # post new release notes
    textToPost = getTextToPost(commits)
    comment = '*{title}*\n{body}'.format(**textToPost)
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
    USERNAME = os.environ.get('USERNAME', 'USER_NOT_FOUND')
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
