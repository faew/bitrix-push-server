# Copyright © 2019 Feature.su. All rights reserved.
# Licensed under the Apache License, Version 2.0 

cat /etc/push-server/docker-$MODE.conf | sed -e "s/__SECURITY_KEY__/$SECURITY_KEY/g;"> /etc/push-server/config.json

node server.js --config /etc/push-server/config.json
