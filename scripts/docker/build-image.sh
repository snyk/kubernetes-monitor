#! /bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# default value for our name and tag, when we don't want to push the image
# for example when testing locally or on opening a PR
LOCAL_DISCARDABLE_IMAGE=snyk/kubernetes-monitor:local

# allow overriding name and tag, when we intend to push the image
# should happen on merging to `staging`
NAME_AND_TAG=${1:-$LOCAL_DISCARDABLE_IMAGE}

docker build -t ${NAME_AND_TAG} .

"$DIR/smoke-test-image-binaries.sh" $NAME_AND_TAG
