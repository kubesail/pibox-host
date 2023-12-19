#!/bin/bash

set +e

USER=$1

if [ -z "$USER" ]; then
    echo "Usage: $0 <username-to-delete>"
    exit 1
fi

deluser --remove-home dan
umount /pibox
vgchange -an pibox_vg
echo "YES" | cryptsetup luksClose /dev/mapper/encrypted_sda
echo "YES" | cryptsetup luksClose /dev/mapper/encrypted_sdb
sudo dd if=/dev/zero of=/dev/sda bs=1M count=10
sudo dd if=/dev/zero of=/dev/sdb bs=1M count=10
rm /etc/pibox-host/initial-setup-complete
deluser --remove-home ${USER}

curl localhost/api/util/disk-locking-status | jq
