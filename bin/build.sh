#!/bin/bash
set -e # bail on error

# Check for dirty files
if [[ $(git status --porcelain) ]]; then
  echo "There are dirty files. Please commit or stash them before running this script."
  exit 1
fi

# Build and package
PIBOX_HOST_VERSION=v$(cat package.json | jq -r .version)
rm -rf .next
rm -rf node_modules
yarn install --production
NEXT_TELEMETRY_DISABLED=1 yarn next build
tar -cvzf pibox-host-$PIBOX_HOST_VERSION.tar.gz .next server.js node_modules package.json pibox-host.service

# Prompt for publishing to GitHub
echo "Would you like to publish a new release to GitHub? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
  git tag $PIBOX_HOST_VERSION
  git push origin $PIBOX_HOST_VERSION
  gh release create $PIBOX_HOST_VERSION pibox-host-$PIBOX_HOST_VERSION.tar.gz
fi