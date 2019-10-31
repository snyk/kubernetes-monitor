#---------------------------------------------------------------------
# STAGE 1: Build skopeo inside a temporary container
#---------------------------------------------------------------------
FROM golang:1.13.1-alpine3.10 AS skopeo-build

RUN apk --no-cache add git make gcc musl-dev ostree-dev go-md2man
RUN git clone --depth 1 -b 'v0.1.39' https://github.com/containers/skopeo $GOPATH/src/github.com/containers/skopeo
RUN cd $GOPATH/src/github.com/containers/skopeo \
  && make binary-local-static DISABLE_CGO=1 \
  && make install

#---------------------------------------------------------------------
# STAGE 2: Build the go-rpmdb tool.
#---------------------------------------------------------------------
FROM golang:1.13.1-alpine3.10 AS rpmdb-build

RUN apk --no-cache add git gcc musl-dev db-dev openssl-dev
RUN git clone --depth 1 -b 'v1.1.0' https://github.com/snyk/go-rpmdb $GOPATH/src/github.com/snyk/go-rpmdb
RUN cd $GOPATH/src/github.com/snyk/go-rpmdb \
    && GIT_COMMIT=$(git rev-parse HEAD 2> /dev/null || true) \
    && GO111MODULE=on go build -ldflags "-X main.gitCommit=${GIT_COMMIT}" -o rpmdb ./cmd/rpmdb

#---------------------------------------------------------------------
# STAGE 3: Build the kubernetes-monitor
#---------------------------------------------------------------------
FROM node:dubnium-alpine

LABEL maintainer="Snyk Ltd"

ENV NODE_ENV production

COPY --from=skopeo-build /usr/bin/skopeo /usr/bin/skopeo
COPY --from=skopeo-build /etc/containers/registries.d/default.yaml /etc/containers/registries.d/default.yaml
COPY --from=skopeo-build /etc/containers/policy.json /etc/containers/policy.json

RUN apk --no-cache add db
COPY --from=rpmdb-build /go/src/github.com/snyk/go-rpmdb/rpmdb /usr/bin/rpmdb

WORKDIR /root

# Add manifest files and install before adding anything else to take advantage of layer caching
ADD package.json package-lock.json .snyk ./

RUN npm install

# add the rest of the app files
ADD . .

# Complete any `prepare` tasks (e.g. typescript), as this step ran automatically prior to app being copied
RUN npm run prepare

ENTRYPOINT ["bin/start"]
