# PiBox Host Service

This NodeJS based service runs on the PiBox locally and provides the following functionality:

- Web UI for configuring the PiBox, adding users, browsing files
- An HTTP/HTTPS API for accessing the PiBox via PiBox mobile / desktop apps

## API Endpoints

Endpoints are documented in Postman: https://www.postman.com/piboxapi/workspace/pibox-workspace/collection/2213994-c9cde7ef-61ed-4c29-9410-6209da725830

## Dependencies

```bash
# Hdd tools, password tools
sudo apt-get install -y smartmontools whois
# Give sudoers NOPASSWD requirement (same as pi user)
sudo sed -i 's/%sudo\tALL=(ALL:ALL) ALL/%sudo\tALL=(ALL:ALL) NOPASSWD: ALL/' /etc/sudoers
```
