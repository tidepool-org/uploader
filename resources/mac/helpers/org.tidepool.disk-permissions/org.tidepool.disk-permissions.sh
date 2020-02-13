#!/bin/bash

for DEVICE in `ls /dev/rdisk*`; do
    diskutil info $DEVICE | grep -q "LifeScan Media"
    if [ "$?" -eq "0" ]; then
        chmod a+rw $DEVICE
    fi
done
