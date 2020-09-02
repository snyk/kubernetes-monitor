#---------------------------------------------------------------------
# STAGE 1: Build skopeo inside a temporary container
#---------------------------------------------------------------------
FROM golang:1.13.1-alpine3.10 AS skopeo-build

RUN apk --no-cache add git make gcc musl-dev ostree-dev go-md2man
RUN git clone --depth 1 -b 'v0.2.0' https://github.com/containers/skopeo $GOPATH/src/github.com/containers/skopeo
RUN cd $GOPATH/src/github.com/containers/skopeo \
  && make binary-local-static DISABLE_CGO=1 \
  && make install

#---------------------------------------------------------------------
# STAGE 2: Build the kubernetes-monitor
#---------------------------------------------------------------------
FROM registry.access.redhat.com/ubi8/ubi:latest

LABEL name="Snyk Controller" \
      maintainer="support@snyk.io" \
      vendor="Snyk Ltd" \
      summary="Snyk integration for Kubernetes" \
      description="Snyk Controller enables you to import and test your running workloads and identify vulnerabilities in their associated images and configurations that might make those workloads less secure."

COPY LICENSE /licenses/LICENSE

ENV NODE_ENV production

RUN curl -sL https://rpm.nodesource.com/setup_12.x | bash -
RUN yum install -y nodejs

RUN curl -L -o /usr/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_amd64
RUN chmod 755 /usr/bin/dumb-init

RUN groupadd -g 10001 snyk
RUN useradd -g snyk -d /srv/app -u 10001 snyk

WORKDIR /srv/app

COPY --chown=snyk:snyk --from=skopeo-build /usr/bin/skopeo /usr/bin/skopeo
COPY --chown=snyk:snyk --from=skopeo-build /etc/containers/registries.d/default.yaml /etc/containers/registries.d/default.yaml
COPY --chown=snyk:snyk --from=skopeo-build /etc/containers/policy.json /etc/containers/policy.json

# Add manifest files and install before adding anything else to take advantage of layer caching
ADD --chown=snyk:snyk package.json package-lock.json .snyk ./

# The `.config` directory is used by `snyk protect` and we also mount a K8s volume there at runtime.
# This clashes with OpenShift 3 which mounts things differently and prevents access to the directory.
# TODO: Remove this line once OpenShift 3 comes out of support.
RUN mkdir -p .config

RUN npm install

# add the rest of the app files
ADD --chown=snyk:snyk . .

# OpenShift 4 doesn't allow dumb-init access the app folder without this permission.
RUN chmod 755 /srv/app && chmod 755 /srv/app/bin && chmod +x /srv/app/bin/start

# This must be in the end for Red Hat Build Service
RUN chown -R snyk:snyk .
USER 10001:10001

# Complete any `prepare` tasks (e.g. typescript), as this step ran automatically prior to app being copied
RUN npm run prepare

ENTRYPOINT ["/usr/bin/dumb-init", "--", "bin/start"]
