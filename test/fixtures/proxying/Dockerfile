FROM debian:buster-slim
WORKDIR /src

RUN apt-get update && apt-get install -y libpcre3-dev wget patch build-essential git zlib1g-dev libssl-dev

RUN cd /tmp && \
  wget https://nginx.org/download/nginx-1.16.1.tar.gz && \
  tar -xzvf nginx-1.16.1.tar.gz && \
  git clone https://github.com/chobits/ngx_http_proxy_connect_module && \
  cd nginx-1.16.1/ && \
  wget https://raw.githubusercontent.com/chobits/ngx_http_proxy_connect_module/master/patch/proxy_connect_rewrite_101504.patch && \
  patch -p1 < proxy_connect_rewrite_101504.patch && \
  ./configure --add-module=/tmp/ngx_http_proxy_connect_module && \
  make && \
  make install

RUN apt-get purge -y libpcre3-dev wget patch build-essential git zlib1g-dev libssl-dev && \
  apt-get remove --purge --auto-remove -y && \
  rm -rf /tmp/*

RUN mkdir -p /var/log/nginx && \
  ln -sf /dev/stdout /var/log/nginx/access.log && \
  ln -sf /dev/stderr /var/log/nginx/error.log

ADD nginx.conf /etc/nginx/nginx.conf

ENV PATH="/usr/local/nginx/sbin:${PATH}"
CMD ["nginx", "-g", "daemon off;"]
