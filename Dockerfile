FROM nodesource/nsolid:dubnium-latest

MAINTAINER Snyk Ltd

ENV NODE_ENV production

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

ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 1212
CMD ["bin/start"]
