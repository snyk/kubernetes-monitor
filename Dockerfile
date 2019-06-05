FROM nodesource/nsolid:dubnium-latest

MAINTAINER Snyk Ltd

ENV NODE_ENV production

# INSTALLING DOCKER, CAN BE REMOVED WHEN WE DON'T TRY TO `DOCKER PULL`
ENV DOCKERVERSION=18.06.3-ce
RUN curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKERVERSION}.tgz \
 && tar xzvf docker-${DOCKERVERSION}.tgz --strip 1 \
                -C /usr/local/bin docker/docker \
 && rm docker-${DOCKERVERSION}.tgz

RUN mkdir -p /srv/app
WORKDIR /srv/app

RUN useradd --home-dir /srv/app -s /bin/bash snyk
RUN chown -R snyk:snyk /srv/app
USER snyk

# Add manifest files and install before adding anything else to take advantage of layer caching
ADD --chown=snyk:snyk package.json package-lock.json .snyk ./

ARG NPMJS_TOKEN
RUN echo //registry.npmjs.org/:_authToken=$NPMJS_TOKEN >> ~/.npmrc && \
  npm install && \
  rm ~/.npmrc

# add the rest of the app files
ADD --chown=snyk:snyk . .

# Complete any `prepare` tasks (e.g. typescript), as this step ran automatically prior to app being copied
RUN npm run prepare

ENTRYPOINT ["bin/start"]
