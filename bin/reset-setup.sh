#!/bin/bash

set +e

USER=$1

if [ -z "$USER" ]; then
    echo "Usage: $0 <username-to-delete>"
    exit 1
fi

deluser --remove-home $USER
umount /pibox
vgchange -an pibox_vg
echo "YES" | cryptsetup luksClose /dev/mapper/encrypted_sda
echo "YES" | cryptsetup luksClose /dev/mapper/encrypted_sdb
dd if=/dev/zero of=/dev/sda bs=1M count=100
dd if=/dev/zero of=/dev/sdb bs=1M count=100
rm -vf /etc/pibox-host/*
deluser --remove-home ${USER}

curl localhost/api/util/disk-locking-status | jq
