# Bitrix push server

Install before apache and bitrix

push-apache.conf can use as part of VirtualHost or globaly as this install

Main bitrix domain must use valid SSL certificate

## Install standalone:
```bush
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


Init repo with public code
http://repos.1c-bitrix.ru/yum/el/7/x86_64/push-server-1.0.0-4.el7.centos.noarch.rpm

Make it work in modern CentOS without BitrixVM
