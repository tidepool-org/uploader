#!/bin/bash

set -eu

npm config set scripts-prepend-node-path true

yarn --cwd /home/node/uploader/ install

yarn --cwd /home/node/uploader/ run dev

# wait forever
while true
do
  tail -f /dev/null & wait ${!}
done