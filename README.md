# Bitrix push server

Install before apache and bitrix

push-apache.conf can use as part of VirtualHost or globaly as this install

Main bitrix domain must use valid SSL certificate

## Install standalone:
```console
cd /tmp
wget https://raw.githubusercontent.com/faew/bitrix-push-server/master/install.sh
sh install.sh
```

### Bitrix Module Settings	-> Push and Pull

#### "Push server" is installed and active on the server:
Bitrix Virtual Appliance 7.1-7.2 (Bitrix Push server 1.0)

#### Server command publish URL:
Message sender path: https://example.com/bitrix/pub/

Signature code for server interaction: KEY from install

#### Command reading URL for modern browsers
Message listener path (HTTP): http://#DOMAIN#/bitrix/sub/

Message listener path (HTTPS): https://#DOMAIN#/bitrix/sub/

#### Command reading URL for Web Socket enabled browsers
Message listener path (HTTP): ws://#DOMAIN#/bitrix/subws/

Message listener path (HTTPS): wss://#DOMAIN#/bitrix/subws/

### Docker Compose

Build from Dockerfile
```console
docker build --rm --no-cache -t faew/bitrix-push-server .
```
MODE=pub/sub

SECURITY_KEY=Signature in bitrix configuration

```yaml
version: '3'
services:
    push-pub01:
        image: faew/bitrix-push-server
        container_name: push-pub01
        environment:
            SECURITY_KEY: strongkey
            MODE: pub
        links:
            - redis
    push-sub01:
        image: faew/bitrix-push-server
        container_name: push-sub01
        environment:
            SECURITY_KEY: strongkey
            MODE: sub
        links:
            - redis
    redis:
        image: redis
```
You must use link to redis.

Link push-pub* and push-sub* for you application.
Use it for balancer configuration.

```
   <Proxy "balancer://nodejs_subws">
    BalancerMember "ws://push-sub01:80"
    BalancerMember "ws://push-sub02:80"
   </Proxy>
```

Full standalone config in push-apache.conf

### Init repo with public code
http://repos.1c-bitrix.ru/yum/el/7/x86_64/push-server-1.0.0-4.el7.centos.noarch.rpm

Make it work in CentOS 7 without BitrixVM
