#!/bin/sh -e

wget -q -O artifact_node.sh 'https://raw.githubusercontent.com/tidepool-org/tools/add-circleci/artifact/artifact.sh'
chmod +x artifact_node.sh

. ./version.sh
./artifact_node.sh node
