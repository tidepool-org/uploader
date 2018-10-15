#!/bin/sh
BASE_PATH="$(cd "$(dirname "${0}")" 2>/dev/null && pwd)"
HELPER_SCRIPT="org.tidepool.disk-permissions.sh"
HELPER_SCRIPT_PATH="/Library/PrivilegedHelperTools"
PLIST_NAME="org.tidepool.disk-permissions.plist"
PLIST_PATH="/Library/LaunchDaemons"

if [ test -z $BASE_PATH ]; then
   echo "Base path not found."
   exit 1
fi

if [ "${1}" = "--uninstall" ]; then
    if [ -e "${PLIST_PATH}" ]; then
        echo "Uninstalling Tidepool disk permission helper..."
        sudo launchctl unload "${PLIST_PATH}/${PLIST_NAME}"
        sudo rm "${HELPER_SCRIPT_PATH}/${HELPER_SCRIPT}" "${PLIST_PATH}/${PLIST_NAME}"
        echo "Done."
    else
        echo "Tidepool disk permission helper not found."
    fi
elif [ "${1}" = "--install" ]; then
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
else
    echo "usage: ${0} [--install|--uninstall]"
fi
