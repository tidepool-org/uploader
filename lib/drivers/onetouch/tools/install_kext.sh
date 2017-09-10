#!/bin/sh
BASE_PATH=$(cd "$(dirname "${0}")"; pwd)
KEXT_INSTALL_PATH="/System/Library/Extensions"
KEXT_NAME="TidepoolUsbVerio.kext"
KEXT_PATH="${KEXT_INSTALL_PATH}/${KEXT_NAME}"

if [ "${1}" = "--uninstall" ]; then
    if [ -e "${KEXT_PATH}" ]; then
        echo "Unloading Tidepool USB Driver..."
        sudo kextunload "${KEXT_PATH}"
        echo "Done."

        echo "Uninstalling Tidepool USB Driver from '${KEXT_PATH}'..."
        sudo rm -rf "${KEXT_PATH}"
        # force kext cache to update on next boot
        sudo touch "${KEXT_INSTALL_PATH}"
        echo "Done."
    else
        echo "Tidepool USB Driver not found at '${KEXT_PATH}'."
    fi
else
    echo "Installing Tidepool USB Driver to '${KEXT_PATH}'..."
    sudo mkdir -p "${KEXT_INSTALL_PATH}"
    sudo cp -R "${BASE_PATH}/${KEXT_NAME}" "${KEXT_INSTALL_PATH}"
    sudo chown -R root:wheel "${KEXT_PATH}"
    echo "Done."

    echo "Loading Tidepool USB Driver..."
    sudo kextload "${KEXT_PATH}"
    # force kext cache to update on next boot
    sudo touch "${KEXT_INSTALL_PATH}"
    echo "Done."
fi
