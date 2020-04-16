FROM debian:buster-slim

RUN apt-get update
RUN apt-get install --yes tinyproxy

ADD tinyproxy.conf /etc/tinyproxy/tinyproxy.conf

CMD ["/usr/bin/tinyproxy", "-d"]
