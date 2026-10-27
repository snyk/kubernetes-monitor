#! /bin/bash
set -ex

timeout 10 docker run --rm --entrypoint /usr/bin/dumb-init $1 --version
timeout 30 docker run --rm --entrypoint /bin/sh $1 -c 'mkdir out && skopeo copy docker://docker.io/library/hello-world:latest dir:./out'
timeout 30 docker run --rm --entrypoint /bin/sh $1 -c './bin/start & (sleep 5 && kill -0 $!)'
timeout 30 docker run --rm --entrypoint node -v "$(cd "$(dirname "$0")" && pwd)/check-image-trust.js:/tmp/check-image-trust.js:ro" $1 /tmp/check-image-trust.js
