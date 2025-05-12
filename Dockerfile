#---------------------------------------------------------------------
# STAGE 1: Build credential helpers inside a temporary container
#---------------------------------------------------------------------
FROM --platform=linux/amd64 golang:1.23-alpine AS cred-helpers-build

RUN apk add git
RUN go install github.com/awslabs/amazon-ecr-credential-helper/ecr-login/cli/docker-credential-ecr-login@bef5bd9384b752e5c645659165746d5af23a098a
RUN --mount=type=secret,id=gh_token,required=true \
    git config --global url."https://$(cat /run/secrets/gh_token):x-oauth-basic@github.com/snyk".insteadOf "https://github.com/snyk" && \
    go env -w GOPRIVATE=github.com/snyk && \
    go install github.com/snyk/docker-credential-acr-env@62fbee8398a22171cb0f628400a29b2ebaed7a3a && \
    git config --global --unset url."https://$(cat /run/secrets/gh_token):x-oauth-basic@github.com/snyk".insteadOf

#---------------------------------------------------------------------
# STAGE 2: Build kubernetes-monitor application
#---------------------------------------------------------------------
FROM --platform=linux/amd64 node:18-alpine3.20

LABEL name="Snyk Controller" \
    maintainer="support@snyk.io" \
    vendor="Snyk Ltd" \
    summary="Snyk integration for Kubernetes" \
    description="Snyk Controller enables you to import and test your running workloads and identify vulnerabilities in their associated images and configurations that might make those workloads less secure."

COPY LICENSE /licenses/LICENSE

ENV NODE_ENV=production

RUN apk update
RUN apk upgrade
RUN apk --no-cache add dumb-init skopeo curl bash python3

RUN npm install -g npm@v10.9.2

RUN addgroup -S -g 10001 snyk
RUN adduser -S -G snyk -h /srv/app -u 10001 snyk

# Install gcloud
RUN curl -sL https://sdk.cloud.google.com > /install.sh
RUN bash /install.sh --disable-prompts --install-dir=/ && \
    rm -rf /google-cloud-sdk/platform /google-cloud-sdk/bin/anthoscli /google-cloud-sdk/bin/gcloud-crc32c
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
