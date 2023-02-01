#! /bin/bash

# default value for our name and tag, when we don't want to push the image
# for example when testing locally or on opening a PR
LOCAL_DISCARDABLE_IMAGE=snyk/kubernetes-monitor:ubi8

# allow overriding name and tag, when we intend to push the image
# should happen on merging to `staging`
NAME_AND_TAG=${1:-$LOCAL_DISCARDABLE_IMAGE}

# This step gets the latest version of node 16 from node.js. It removes the .tar.gz extension and then returns the result.
# It is used when buidling the ubi image in order to download the latest node 16 version and copy its binary.
NODE_16_LATEST_VERSION_TAR_GZ_FILE=$(curl --fail --silent https://nodejs.org/dist/latest-v16.x/SHASUMS256.txt | grep linux-x64.tar.gz | awk '{ print $2 }') 
NODE_16_LATEST_VERSION="${NODE_16_LATEST_VERSION_TAR_GZ_FILE%%.tar.gz}"

docker build --build-arg  NODE_16_LATEST_VERSION="${NODE_16_LATEST_VERSION}" -t ${NAME_AND_TAG} --file=Dockerfile.ubi8 .
