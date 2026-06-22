#---------------------------------------------------------------------
# STAGE 1: Build credential helpers inside a temporary container
#---------------------------------------------------------------------
FROM --platform=linux/amd64 golang:1.25-alpine AS cred-helpers-build

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
FROM --platform=linux/amd64 node:22-alpine3.23

LABEL name="Snyk Controller" \
    maintainer="support@snyk.io" \
    vendor="Snyk Ltd" \
    summary="Snyk integration for Kubernetes" \
    description="Snyk Controller enables you to import and test your running workloads and identify vulnerabilities in their associated images and configurations that might make those workloads less secure."

COPY LICENSE /licenses/LICENSE

ENV NODE_ENV=production

RUN apk update
RUN apk upgrade
RUN apk --no-cache add dumb-init curl bash python3

RUN npm install -g npm@10.9.7

RUN addgroup -S -g 10001 snyk
RUN adduser -S -G snyk -h /srv/app -u 10001 snyk

# Install skopeo from a pinned static binary rather than apk: Alpine's packaged skopeo (1.20.1)
# bundles a vulnerable google.golang.org/grpc (CVE-2026-33186); the fix only exists upstream in
# skopeo >=1.22, which Alpine has not packaged on any branch. Keep this version in sync with Dockerfile.ubi9.
# https://github.com/lework/skopeo-binary/releases
ARG SKOPEO_VERSION=1.23.0
ARG SKOPEO_BINARY_FILE_SHASUM256=15696e068c02a163e20013fab79f40cdc6c8022d99e1aee8676f6d540404691a
RUN curl -sSfLo /usr/bin/skopeo "https://github.com/lework/skopeo-binary/releases/download/v${SKOPEO_VERSION}/skopeo-linux-amd64" && \
    chmod 755 /usr/bin/skopeo && \
    echo "${SKOPEO_BINARY_FILE_SHASUM256}  /usr/bin/skopeo" | sha256sum -cs
# The static skopeo binary does not ship a signature policy; create the permissive default
# (matches the policy.json that Alpine's skopeo package previously provided).
RUN mkdir -p /etc/containers && \
    printf '{"default":[{"type":"insecureAcceptAnything"}]}\n' > /etc/containers/policy.json

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

RUN --mount=type=secret,id=npm_token,uid=10001 \
    echo "//registry.npmjs.org/:_authToken=$(cat /run/secrets/npm_token)" > ~/.npmrc && \
    npm ci && \
    rm -f ~/.npmrc

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
