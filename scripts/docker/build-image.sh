#! /bin/bash

# default value for our name and tag, when we don't want to push the image
# for example when testing locally or on opening a PR
LOCAL_DISCARDABLE_IMAGE=snyk/kubernetes-monitor:local

# allow overriding name and tag, when we intend to push the image
# should happen on merging to `staging`
NAME_AND_TAG=${1:-$LOCAL_DISCARDABLE_IMAGE}

mkdir -vp ~/.docker/cli-plugins/
curl --silent -L --output ~/.docker/cli-plugins/docker-buildx https://github.com/docker/buildx/releases/download/v0.6.3/buildx-v0.6.3.linux-amd64
chmod a+x ~/.docker/cli-plugins/docker-buildx
docker run -it --rm --privileged tonistiigi/binfmt --install all
docker buildx create --use --name mybuilder
docker buildx build --platform linux/amd64,linux/arm64 -t ${NAME_AND_TAG} --push .
