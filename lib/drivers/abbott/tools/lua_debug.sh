#!/bin/bash

# This script helps with debugging a Lua Wireshark plugin on Linux (and possibly OSX).
# Before using it, install Zero Brane Studio IDE and start its Debugger Server.
# Open the plugin script to be debugged in the IDE from its install path (e.g. the Wireshark plugin dir).
# Make sure the ZBS variable is set to the install path of the IDE:
export ZBS=/opt/zbstudio

# In your Lua plugin add these two lines at the very top:
# _G.debug = require("debug")
# require("mobdebug").start()

# Run this script and it will stop at the above lines in the debugger.



if [[ "$(uname -m)" == "x86_64" ]]; then ARCH="x64"; else ARCH="x86"; fi

export LUA_PATH="./?.lua;$ZBS/lualibs/?/?.lua;$ZBS/lualibs/?.lua"
export LUA_CPATH="$ZBS/bin/?.so;$ZBS/bin/linux/$ARCH/clibs52/?.so"

if [ "$#" -ne 1 ]; then
    echo "usage: $0 PCAP_FILE"
    exit
fi

# If the plugin is loaded automatically by Wireshark from one of its plugin directories:
tshark -r $1
#wireshark -r $1

# If the plugin is to be manually loaded:
#tshark -X lua_script:fslibre_usb_dissector.lua -r $1
#wireshark -X lua_script:fslibre_usb_dissector.lua -r $1
