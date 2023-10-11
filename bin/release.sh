#!/bin/bash
set -e # bail on error



# Build and package
PIBOX_HOST_VERSION=v$(cat package.json | jq -r .version)

# Is version newer than latest release?
LATEST_PUBLISHED_VERSION=$(gh release list | head -n 1 | awk '{print $1}')

echo "Building $LATEST_PUBLISHED_VERSION => $PIBOX_HOST_VERSION"
if [[ "$PIBOX_HOST_VERSION" == "$LATEST_PUBLISHED_VERSION" ]]; then
  echo "Version $PIBOX_HOST_VERSION is already published. Please update package.json and try again."
  exit 1
fi

echo "Do you need to build? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
  # Check for dirty files
  if [[ $(git status --porcelain) ]]; then
    echo "There are dirty files. Please commit or stash them before running this script."
    exit 1
  fi
  rm -rf .next
  rm -rf node_modules
  yarn install --production
  NEXT_TELEMETRY_DISABLED=1 yarn next build
  tar -cvzf pibox-host-$PIBOX_HOST_VERSION.tar.gz .next server.js node_modules package.json pibox-host.service
fi 

# Prompt for publishing to GitHub
echo "Would you like to publish a new release to GitHub? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
  git tag $PIBOX_HOST_VERSION
  git push origin $PIBOX_HOST_VERSION
  gh release create $PIBOX_HOST_VERSION pibox-host-$PIBOX_HOST_VERSION.tar.gz -t $PIBOX_HOST_VERSION -n "$PIBOX_HOST_VERSION"
fi