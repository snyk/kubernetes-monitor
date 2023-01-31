#---------------------------------------------------------------------
# STAGE 1: Build credential helpers inside a temporary container
#---------------------------------------------------------------------
FROM golang:alpine AS cred-helpers-build

RUN go install github.com/awslabs/amazon-ecr-credential-helper/ecr-login/cli/docker-credential-ecr-login@69c85dc22db6511932bbf119e1a0cc5c90c69a7f
RUN go install github.com/chrismellard/docker-credential-acr-env@d4055f832e8b16ea2ee93189c5e14faafd36baf6

#---------------------------------------------------------------------
# STAGE 2: Build the kubernetes-monitor
#---------------------------------------------------------------------
FROM node:gallium-alpine

LABEL name="Snyk Controller" \
      maintainer="support@snyk.io" \
      vendor="Snyk Ltd" \
      summary="Snyk integration for Kubernetes" \
      description="Snyk Controller enables you to import and test your running workloads and identify vulnerabilities in their associated images and configurations that might make those workloads less secure."

COPY LICENSE /licenses/LICENSE

ENV NODE_ENV production

RUN apk update
RUN apk upgrade
RUN apk --no-cache add dumb-init skopeo curl bash python3

RUN addgroup -S -g 10001 snyk
RUN adduser -S -G snyk -h /srv/app -u 10001 snyk

# Install gcloud
RUN curl -sL https://sdk.cloud.google.com > /install.sh
RUN bash /install.sh --disable-prompts --install-dir=/ && rm /google-cloud-sdk/bin/anthoscli && rm -rf /google-cloud-sdk/platform
ENV PATH=/google-cloud-sdk/bin:$PATH
RUN rm /install.sh
RUN apk del curl bash

# Copy credential helpers
COPY --chown=snyk:snyk --from=cred-helpers-build /go/bin/docker-credential-ecr-login /usr/bin/docker-credential-ecr-login
COPY --chown=snyk:snyk --from=cred-helpers-build /go/bin/docker-credential-acr-env /usr/bin/docker-credential-acr-env

WORKDIR /srv/app
USER 10001:10001

# Add manifest files and install before adding anything else to take advantage of layer caching
ADD --chown=snyk:snyk package.json package-lock.json ./

# The `.config` directory is used by `snyk protect` and we also mount a K8s volume there at runtime.
# This clashes with OpenShift 3 which mounts things differently and prevents access to the directory.
# TODO: Remove this line once OpenShift 3 comes out of support.
RUN mkdir -p .config

RUN npm ci

# add the rest of the app files
ADD --chown=snyk:snyk . .

# OpenShift 4 doesn't allow dumb-init access the app folder without this permission.
RUN chmod 755 /srv/app && chmod 755 /srv/app/bin && chmod +x /srv/app/bin/start

# This must be in the end for Red Hat Build Service
RUN chown -R snyk:snyk .
USER 10001:10001

# Build typescript
RUN npm run build

ENTRYPOINT ["/usr/bin/dumb-init", "--", "bin/start"]
