#!/bin/bash
set -e # bail on error

PIBOX_HOST_VERSION=v$(cat package.json | jq -r .version)
TARGET_DIR=/opt/pibox-host/$PIBOX_HOST_VERSION
mkdir -p $TARGET_DIR
echo "Extracting tarball to $TARGET_DIR ... (this may take a while)"
tar -xzf pibox-host-$PIBOX_HOST_VERSION.tar.gz --directory=$TARGET_DIR
cp pibox-host.service /etc/systemd/system/pibox-host.service
sed -i "s/PIBOX_HOST_VERSION/$PIBOX_HOST_VERSION/g" /etc/systemd/system/pibox-host.service
systemctl daemon-reload
systemctl enable pibox-host.service
systemctl start pibox-host.service
systemctl status pibox-host.service
