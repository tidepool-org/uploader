#!/bin/sh
BASE_PATH="$(cd "$(dirname "${0}")"; pwd)/disk_permission_helper"
HELPER_SCRIPT="org.tidepool.disk-permissions.sh"
HELPER_SCRIPT_PATH="/Library/PrivilegedHelperTools"
PLIST_NAME="org.tidepool.disk-permissions.plist"
PLIST_PATH="/Library/LaunchDaemons"

if [ "${1}" = "--uninstall" ]; then
    if [ -e "${PLIST_PATH}" ]; then
        echo "Uninstalling Tidepool disk permission helper..."
        sudo launchctl unload "${PLIST_PATH}/${PLIST_NAME}"
        sudo rm "${HELPER_SCRIPT_PATH}/${HELPER_SCRIPT}" "${PLIST_PATH}/${PLIST_NAME}"
        echo "Done."
    else
        echo "Tidepool disk permission helper not found."
    fi
else
    echo "Installing Tidepool disk permission helper..."
    sudo mkdir -p "${PLIST_PATH}"
    sudo mkdir -p "${HELPER_SCRIPT_PATH}"
    sudo cp "${BASE_PATH}/${HELPER_SCRIPT}" "${HELPER_SCRIPT_PATH}/${HELPER_SCRIPT}"
    sudo cp "${BASE_PATH}/${PLIST_NAME}" "${PLIST_PATH}/${PLIST_NAME}"
    sudo chown -R root:wheel "${HELPER_SCRIPT_PATH}" "${PLIST_PATH}"
    sudo launchctl load "${PLIST_PATH}/${PLIST_NAME}"
    echo "Done."

    echo "Running disk permission helper now..."
    sudo "${HELPER_SCRIPT_PATH}/${HELPER_SCRIPT}"
    echo "Done."
fi
