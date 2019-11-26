#!/bin/sh
HELPER_PATH=$1/helpers

"$HELPER_PATH/org.tidepool.disk-permissions/install.sh" --uninstall

"$HELPER_PATH/org.tidepool.disk-permissions/install.sh" --install

echo "Done."
