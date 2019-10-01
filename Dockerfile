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
# STAGE 2: Build the kubernetes-monitor
#---------------------------------------------------------------------
FROM node:dubnium-alpine

MAINTAINER Snyk Ltd

ENV NODE_ENV production

# INSTALLING DOCKER, CAN BE REMOVED WHEN WE DON'T TRY TO `DOCKER PULL`
ENV DOCKERVERSION=18.06.3-ce
RUN apk --no-cache add --virtual curl-dep curl \
 && curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKERVERSION}.tgz \
 && tar xzvf docker-${DOCKERVERSION}.tgz --strip 1 \
                -C /usr/local/bin docker/docker \
 && rm docker-${DOCKERVERSION}.tgz \
 && apk del curl-dep

COPY --from=skopeo-build /usr/bin/skopeo /usr/bin/skopeo
COPY --from=skopeo-build /etc/containers/registries.d/default.yaml /etc/containers/registries.d/default.yaml
COPY --from=skopeo-build /etc/containers/policy.json /etc/containers/policy.json

WORKDIR /root

# Add manifest files and install before adding anything else to take advantage of layer caching
ADD package.json package-lock.json .snyk ./

RUN npm install

# add the rest of the app files
ADD . .

# Complete any `prepare` tasks (e.g. typescript), as this step ran automatically prior to app being copied
RUN npm run prepare

ENTRYPOINT ["bin/start"]
