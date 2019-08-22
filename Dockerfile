FROM fedora:30

MAINTAINER Snyk Ltd

ENV NODE_ENV production

RUN yum -y install podman
RUN dnf install -y nodejs

WORKDIR /root

# Add manifest files and install before adding anything else to take advantage of layer caching
ADD package.json package-lock.json .snyk ./

# Modify the registries file that tells Podman where to pull images from
ADD registries.conf /etc/containers/registries.conf
COPY storage.conf /etc/containers/storage.conf

RUN npm install

# add the rest of the app files
ADD . .

# Complete any `prepare` tasks (e.g. typescript), as this step ran automatically prior to app being copied
RUN npm run prepare

# Replace docker with podman
ADD docker.js ./node_modules/snyk-docker-plugin/dist/docker.js

ENTRYPOINT ["bin/start"]
