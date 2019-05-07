# TODO can probably use something thinner
FROM python:latest

LABEL maintainer="Snyk Ltd"

RUN mkdir -p /srv/app
WORKDIR /srv/app

RUN useradd --home-dir /srv/app -s /bin/bash snyk
RUN chown -R snyk:snyk /srv/app
USER snyk

# TODO maybe be more explicit about what we need?
ADD --chown=snyk:snyk . .

# upgrade pip?
RUN pip install --user -r requirements.txt

CMD ["bin/start"]
