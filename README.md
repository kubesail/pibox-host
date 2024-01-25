# PiBox Host Service

This NodeJS based service runs on the PiBox locally and provides the following functionality:

- Web UI for configuring the PiBox, adding users, browsing files
- An HTTP/HTTPS API for accessing the PiBox via PiBox mobile / desktop apps

## API Endpoints

Endpoints are documented in Postman: https://www.postman.com/piboxapi/workspace/pibox-workspace/collection/2213994-c9cde7ef-61ed-4c29-9410-6209da725830

## Dependencies

```bash
# Hdd tools, password tools, cairo for canvas NPM package
apt-get install -y \
  vim lvm2 raspberrypi-kernel-headers samba samba-common-bin \
  tmate sysstat git iptables cryptsetup whois \
  jq build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev nodejs

# Give sudoers NOPASSWD requirement (same as pi user)
sed -i 's/%sudo\tALL=(ALL:ALL) ALL/%sudo\tALL=(ALL:ALL) NOPASSWD: ALL/' /etc/sudoers
# Create root files directory (and mount it)
mkdir /files
groupadd sambagroup
```
