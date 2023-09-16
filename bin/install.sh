#!/bin/bash
set -e # bail on error

PIBOX_HOST_VERSION=v$(cat package.json | jq -r .version)
tar -xzf pibox-host-$PIBOX_HOST_VERSION.tar.gz --directory=/opt/pibox-host
cp pibox-host.service /etc/systemd/system/pibox-host.service
sed -i "s/PIBOX_HOST_VERSION/$PIBOX_HOST_VERSION/g" /etc/systemd/system/pibox-host.service
systemctl daemon-reload
systemctl enable pibox-host.service
systemctl start pibox-host.service
systemctl status pibox-host.service
