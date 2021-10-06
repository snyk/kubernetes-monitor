#---------------------------------------------------------------------
# STAGE 1: Build skopeo and ecr-credentials-helper inside a temporary container
#---------------------------------------------------------------------
FROM fedora:32 AS skopeo-build

RUN dnf install -y golang git make
RUN dnf install -y go-md2man gpgme-devel libassuan-devel btrfs-progs-devel device-mapper-devel
RUN git clone --depth 1 -b 'v1.4.1' https://github.com/containers/skopeo $GOPATH/src/github.com/containers/skopeo
RUN cd $GOPATH/src/github.com/containers/skopeo \
  && make bin/skopeo DISABLE_CGO=1 \
  && make install

RUN go get -u github.com/awslabs/amazon-ecr-credential-helper/ecr-login/cli/docker-credential-ecr-login
RUN cp $HOME/go/bin/docker-credential-ecr-login /usr/local/bin/docker-credential-ecr-login

#---------------------------------------------------------------------
# STAGE 2: Build the kubernetes-monitor
#---------------------------------------------------------------------
FROM registry.access.redhat.com/ubi8/ubi:8.4

LABEL name="Snyk Controller" \
      maintainer="support@snyk.io" \
      vendor="Snyk Ltd" \
      summary="Snyk integration for Kubernetes" \
      description="Snyk Controller enables you to import and test your running workloads and identify vulnerabilities in their associated images and configurations that might make those workloads less secure."

COPY LICENSE /licenses/LICENSE

ENV NODE_ENV production

RUN curl -sL https://rpm.nodesource.com/setup_16.x | bash -
RUN yum install -y nodejs

RUN curl -L -o /usr/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.2/dumb-init_1.2.2_amd64
RUN chmod 755 /usr/bin/dumb-init

RUN groupadd -g 10001 snyk
RUN useradd -g snyk -d /srv/app -u 10001 snyk

# Install gcloud 
RUN curl -sL https://sdk.cloud.google.com > /install.sh
RUN bash /install.sh --disable-prompts --install-dir=/ && rm /google-cloud-sdk/bin/anthoscli
ENV PATH=/google-cloud-sdk/bin:$PATH
RUN rm /install.sh

WORKDIR /srv/app

COPY --chown=snyk:snyk --from=skopeo-build /usr/local/bin/skopeo /usr/bin/skopeo
COPY --chown=snyk:snyk --from=skopeo-build /usr/local/bin/docker-credential-ecr-login /usr/bin/docker-credential-ecr-login
COPY --chown=snyk:snyk --from=skopeo-build /etc/containers/registries.d/default.yaml /etc/containers/registries.d/default.yaml
COPY --chown=snyk:snyk --from=skopeo-build /etc/containers/policy.json /etc/containers/policy.json

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
