# Bitrix push server

Install before apache and bitrix

push-apache.conf can use as part of VirtualHost or globaly as this install

Main bitrix domain must use valid SSL certificate

Install standalone:
```bush
cd /tmp
wget https://raw.githubusercontent.com/faew/bitrix-push-server/master/install.sh
sh install.sh
```

Init repo with public code
http://repos.1c-bitrix.ru/yum/el/7/x86_64/push-server-1.0.0-4.el7.centos.noarch.rpm

Make it work in modern CentOS without BitrixVM
