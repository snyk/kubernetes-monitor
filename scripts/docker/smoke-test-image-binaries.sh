#! /bin/bash
set -ex

timeout 10 docker run --rm --entrypoint /usr/bin/dumb-init $1 --version
timeout 30 docker run --rm --entrypoint /bin/sh $1 -c 'mkdir out && skopeo copy docker://docker.io/library/hello-world:latest dir:./out'
timeout 30 docker run --rm --entrypoint /bin/sh $1 -c './bin/start & (sleep 5 && kill -0 $!)'
