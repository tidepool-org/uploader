#!/bin/bash

for DEVICE in `ls /dev/rdisk*`; do
    diskutil info $DEVICE | grep -q "Device / Media Name:      LifeScan Media"
    if [ "$?" == "0" ]; then
        chmod a+rw $DEVICE
    fi
done
