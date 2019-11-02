# Copyright © 2019 Feature.su. All rights reserved.   
# Licensed under the Apache License, Version 2.0

# Warning: install before apache and bitrix
# Warning: push-apache.conf can use as part of VirtualHost or globaly as this install
# Warning: bitrix domain must use valid SSL certificate

cd /tmp
yum -y install nodejs unzip wget httpd
wget https://raw.githubusercontent.com/faew/linux.feature/master/script/centos7/10-install-redis.sh
sh 10-install-redis.sh

wget -O bitrix-push-server.zip https://github.com/faew/bitrix-push-server/archive/master.zip
unzip bitrix-push-server.zip
rm -f bitrix-push-server.zip
cd bitrix-push-server-master
cp -R ./etc/init.d/* /etc/init.d/
cp -R ./etc/push-server/ /etc/
cp -R ./etc/sysconfig/* /etc/sysconfig/
chmod 440 /etc/sysconfig/push-server-multi
useradd --no-create-home --system --shell /usr/sbin/nologin bitrix
chown bitrix:root /etc/sysconfig/push-server-multi
cp -R ./opt/* /opt/
cp -R ./usr/* /usr/
systemctl enable push-server
cd /opt/push-server
npm install
cd ..
chown -R bitrix:root ./push-server
cd /tmp/bitrix-push-server-master
/etc/init.d/push-server-multi reset
systemctl start push-server
echo "Key for bitrix web config"
cat /etc/sysconfig/push-server-multi | grep KEY
cp push-apache.conf /etc/httpd/conf.d/
systemctl reload httpd
