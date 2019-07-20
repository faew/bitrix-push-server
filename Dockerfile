# Copyright © 2019 Feature.su. All rights reserved.
# Licensed under the Apache License, Version 2.0

FROM centos:7

EXPOSE 80
WORKDIR /opt/push-server

MAINTAINER "linux.feature"

RUN yum -y update; yum -y install epel-release;
RUN yum -y install nodejs gcc-c++ make
RUN mkdir /etc/push-server/
COPY ./etc/push-server/ /etc/push-server/
COPY ./opt/ /opt/
RUN cd /opt/push-server;npm install

ENV SECURITY_KEY strongkey
ENV MODE pub

ENTRYPOINT ["sh", "./docker-run.sh"]
