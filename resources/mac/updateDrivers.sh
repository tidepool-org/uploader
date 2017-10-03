#!/bin/sh
DRIVER_PATH=$1

echo "Driver path: $DRIVER_PATH"
echo "Unloading and uninstalling old extensions..."
# unload old extensions
kextunload /Library/Extensions/sweetspot.DexComUSB.kext
kextunload /Library/Extensions/DexcomUSB.kext
kextunload /Library/Extensions/SiLabsUSBDriver.kext
kextunload /Library/Extensions/ProlificUsbSerial.kext

# delete old extensions
rm -rf /Library/Extensions/sweetspot.DexcomUSB.kext
rm -rf /Library/Extensions/DexcomUSB.kext
rm -rf /Library/Extensions/SiLabsUSBDriver.kext
rm -rf /Library/Extensions/ProlificUsbSerial.kext

# install new extensions
echo "Installing and loading new extensions..."
cp -R "$DRIVER_PATH/DexComUSB.kext" /Library/Extensions/DexComUSB.kext
chown -R root:wheel /Library/Extensions/DexcomUSB.kext
kextload /Library/Extensions/DexComUSB.kext/

cp -R "$DRIVER_PATH/SiLabsUSBDriver.kext" /Library/Extensions/SiLabsUSBDriver.kext
chown -R root:wheel /Library/Extensions/SiLabsUSBDriver.kext
kextload /Library/Extensions/SiLabsUSBDriver.kext/

cp -R "$DRIVER_PATH/ProlificUsbSerial.kext" /Library/Extensions/ProlificUsbSerial.kext
chown -R root:wheel /Library/Extensions/ProlificUsbSerial.kext
kextload /Library/Extensions/ProlificUsbSerial.kext/

echo "Done."
