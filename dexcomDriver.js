var util = {
    extractString: function(bytes, start, len) {
        if (!len) {
            len = bytes.length;
        }
        s = "";
        for (var i=start; i<len; ++i) {
            s += String.fromCharCode(bytes[i]);
        }
        return s;
    },
    extractInt: function(b, st) {
        return ((b[st+3] << 24) + (b[st+2] << 16) + (b[st+1] << 8) + b[st]);
    },
    extractShort: function(b, st) {
        return ((b[st+1] << 8) + b[st]);
    }
};

var dexcomDriver = {
    SYNC_BYTE: 0x01,
    CMDS: {
        READ_FIRMWARE_HEADER: { value: 11, name: "Read Firmware Header" },
        READ_DATA_PAGE_RANGE: { value: 16, name: "Read Data Page Range" },
        READ_DATA_PAGES: { value: 17, name: "Read Data Pages" },
        READ_DATA_PAGE_HEADER: { value: 18, name: "Read Data Page Header" }
    },
    RECORD_TYPES: {
        MANUFACTURING_DATA: { value: 0, name: "MANUFACTURING_DATA" },
        FIRMWARE_PARAMETER_DATA: { value: 1, name: "FIRMWARE_PARAMETER_DATA" },
        PC_SOFTWARE_PARAMETER: { value: 2, name: "PC_SOFTWARE_PARAMETER" },
        SENSOR_DATA: { value: 3, name: "SENSOR_DATA" },
        EGV_DATA: { value: 4, name: "EGV_DATA" },
        CAL_SET: { value: 5, name: "CAL_SET" },
        DEVIATION: { value: 6, name: "DEVIATION" },
        INSERTION_TIME: { value: 7, name: "INSERTION_TIME" },
        RECEIVER_LOG_DATA: { value: 8, name: "RECEIVER_LOG_DATA" },
        RECEIVER_ERROR_DATA: { value: 9, name: "RECEIVER_ERROR_DATA" },
        METER_DATA: { value: 10, name: "METER_DATA" },
        USER_EVENT_DATA: { value: 11, name: "USER_EVENT_DATA" },
        USER_SETTING_DATA: { value: 12, name: "USER_SETTING_DATA" },
        MAX_VALUE: { value: 13, name: "MAX_VALUE" }
    },


    /*********************************************************************
     * Function:    calcCRC()
     * Description: Compute the Zmodem CRC of a given array of bytes, which has
     *              been tested to be compatible with the C++ code that we
     *              were given by dexcom.
     * Notes:       The CRC table is well-known and dates back at least to the 
     *              1980s where it was used in the Zmodem protocol. However, 
     *              in Zmodem and many other implementations, the INITIAL_REMAINDER
     *              was 0, not 0xFFFF. Consequently, be careful if you use
     *              any other implementation of CRC.
     * Inputs:      dataRec - pointer to ArrayBuffer to have crc performed.
     *              Does not include the CRC field.
     *              size - Number of bytes in dataRec.
     * Returns:     The CRC of the buffer.
     *********************************************************************/
    // builds a command in an ArrayBuffer
    // The first byte is always 0x01 (SYNC), 
    // the second and third bytes are a little-endian payload length.
    // then comes the payload, 
    // finally, it's followed with a 2-byte little-endian CRC of all the bytes
    // up to that point.
    // payload is any indexable array-like object that returns Numbers

    buildPacket: function(command, payloadLength, payload) {
        var datalen = payloadLength + 6;
        var buf = new ArrayBuffer(datalen);
        var bytes = new Uint8Array(buf);
        bytes[0] = dexcomDriver.SYNC_BYTE;
        bytes[1] = datalen & 0xFF;
        bytes[2] = (datalen >> 8) & 0xFF;
        bytes[3] = command;
        for (var i = 0; i < payloadLength; ++i) {
            bytes[4 + i] = payload[i];
        }
        var crc = crcCalculator.calcDexcomCRC(bytes, payloadLength+4);
        bytes[payloadLength + 4] = crc & 0xFF;
        bytes[payloadLength + 5] = (crc >> 8) & 0xFF;
        return buf;
    },

    readFirmwareHeader: function() {
        return {
            packet: dexcomDriver.buildPacket(
                dexcomDriver.CMDS.READ_FIRMWARE_HEADER.value, 0, null
            ),
            parser: dexcomDriver.parseXMLPayload
        };
    },

    readDataPageRange: function(rectype) {
        return {
            packet: dexcomDriver.buildPacket(
                dexcomDriver.CMDS.READ_DATA_PAGE_RANGE.value, 
                1,
                [rectype.value]
            ),
            parser: function(result) {
                return [
                    util.extractInt(result.payload, 0),
                    util.extractInt(result.payload, 4)
                    ];
                }
            };
    },

    readDataPages: function() {
        return {
            packet: dexcomDriver.buildPacket(
                dexcomDriver.CMDS.READ_DATA_PAGES.value, 0, null
            ),
            parser: null
        };
    },

    readDataPageHeader: function() {
        return {
            packet: dexcomDriver.buildPacket(
                dexcomDriver.CMDS.READ_DATA_PAGE_HEADER.value, 0, null
            ),
            parser: null
        };
    },


    // accepts a stream of bytes and tries to find a dexcom packet
    // at the beginning of it.
    // returns a packet object; if valid == true it's a valid packet
    // if packet_len is nonzero, that much should be deleted from the stream
    // if valid is false and packet_len is nonzero, the previous packet 
    // should be NAKed.
    extractPacket: function(bytestream) {
        var bytes = new Uint8Array(bytestream);
        var packet = { 
            valid: false, 
            packet_len: 0,
            command: 0,
            payload: null, 
            crc: 0
        };

        if (bytes[0] != dexcomDriver.SYNC_BYTE) {
            return packet;
        }

        plen = bytes.length;
        packet_len = util.extractShort(bytes, 1);
        // minimum packet len is 6
        if (packet_len < plen) {
            return packet;  // we're not done yet
        }

        // we now have enough length for a complete packet, so calc the CRC 
        packet.packet_len = packet_len;
        packet.crc = util.extractShort(bytes, packet_len - 2);
        var crc = crcCalculator.calcDexcomCRC(bytes, packet_len - 2);
        if (crc != packet.crc) {
            // if the crc is bad, we should discard the whole packet
            // (packet_len is nonzero)
            return packet;
        }

        // command is the fourth byte, packet is remainder of data
        packet.command = bytes[3];
        packet.payload = new Uint8Array(packet_len - 6);
        for (var i=0; i<packet_len - 6; ++i) {
            packet.payload[i] = bytes[i + 4];
        }

        packet.valid = true;
        return packet;
    },

    // Takes an xml-formatted string and returns an object
    parseXML: function(s) {
        console.log(s);
        result = {tag:'', attrs:{}};
        var tagpat = /<([A-Za-z]+)/;
        var m = s.match(tagpat);
        if (m) {
            result.tag = m[1];
        }
        var gattrpat = /([A-Za-z]+)='([^']+)'/g;
        var attrpat = /([A-Za-z]+)='([^']+)'/;
        m = s.match(gattrpat);
        for (var r in m) {
            var attr = m[r].match(attrpat);
            if (result.attrs[attr[1]]) {
                console.log("Duplicated attribute!");
            }
            result.attrs[attr[1]] = attr[2];
        }
        return result;
    },

    parseXMLPayload: function(packet) {
        if (!packet.valid) {
            return {};
        }
        if (packet.command !== 1) {
            return {};
        }

        var len = packet.packet_len - 6;
        var data = null;
        if (len) {
            data = dexcomDriver.parseXML(
                util.extractString(packet.payload, 0, len));
        }
        return data;
    }
};
