var asanteDriver = {
    SYNC_BYTE: 0x7E,
    INITIAL_REMAINDER: 0xFFFF,
    FINAL_XOR_VALUE: 0x0000,
    CRC_TABLE: new Array(
        0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
        0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef,
        0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6,
        0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de,
        0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485,
        0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d,
        0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4,
        0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc,
        0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
        0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b,
        0x5af5, 0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12,
        0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a,
        0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41,
        0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49,
        0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70,
        0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78,
        0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f,
        0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
        0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e,
        0x02b1, 0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256,
        0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
        0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
        0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e, 0xc71d, 0xd73c,
        0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634,
        0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab,
        0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3,
        0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
        0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92,
        0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9,
        0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1,
        0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8,
        0x6e17, 0x7e36, 0x4e55, 0x5e74, 0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
    ),

    BAUDRATES: {
        BAUD_9600: { value: 1, name: "9600"},
        BAUD_19200: { value: 2, name: "19200"},
        BAUD_28800: { value: 3, name: "28800"},
        BAUD_38400: { value: 4, name: "38400"},
        BAUD_48000: { value: 5, name: "48000"},
        BAUD_57600: { value: 6, name: "57600"},
        BAUD_96000: { value: 10, name: "96000"},
        BAUD_115200: { value: 12, name: "115200"}
    },

    PUMP_DATA_RECORDS: {
        LOG_BOLUS: { value: 0, name: "Log Bolus", max: 450, type: "log" },
        LOG_SMART: { value: 0, name: "Log Smart", max: 450, type: "log" },
        LOG_BASAL: { value: 0, name: "Log Basal", max: 2232, type: "log" },
        LOG_BASAL_CONFIG: { value: 0, name: "Log Basal Config", max: 400, type: "log" },
        LOG_ALARM_ALERT: { value: 0, name: "Log Alarm Alert", max: 400, type: "log" },
        LOG_PRIME: { value: 0, name: "Log Prime", max: 128, type: "log" },
        LOG_PUMP: { value: 0, name: "Log Pump", max: 512, type: "log" },
        LOG_MISSED_BASAL: { value: 0, name: "Log Missed Basal", max: 256, type: "log" },
        LOG_TIME_EDITS: { value: 0, name: "Log Time Edits", max: 64, type: "log" },
        LOG_USER_SETTINGS: { value: 0, name: "Log User Settings", max: 1, type: "settings" },
        LOG_TIME_MANAGER_DATA: { value: 0, name: "Log Time Manager Data", max: 1, type: "settings" },
    },


    /*********************************************************************
     * Function:    calcCRC()
     * Description: Compute the Zmodem CRC of a given array of bytes, which has
     *              been tested to be compatible with the C++ code that we
     *              were given by Asante.
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
    calcCRC : function (bytes, size) {
        var crc16;
        var i, j;

        crc16 = asanteDriver.INITIAL_REMAINDER;
        // Divide the buffer by the polynomial, a byte at a time.
        for (i=0; i<size; i++)
        {
            crc16 = asanteDriver.CRC_TABLE[(bytes[i] ^ (crc16 >> 8)) & 0xFF] ^ ((crc16 << 8) & 0xFFFF);
        }
        // The final remainder is the CRC.
        return (crc16 ^ asanteDriver.FINAL_XOR_VALUE);
    },

    testCRC: function(s) {
        var buf = new ArrayBuffer(s.length);
        bytes = new Uint8Array(buf);
        for (var i=0; i<s.length; ++i) {
            bytes[i] = s.charCodeAt(i);
        }
        console.log(bytes);
        var crc = asanteDriver.calcCRC(bytes, s.length);
        console.log(crc);
        return crc;
    },


    validateCRC: function () {
        if (asanteDriver.testCRC('\x02\x06\x06\x03') == 0x41CD) {
            console.log("CRC logic is correct.");
        } else {
            console.log("CRC logic is NOT CORRECT!!!");
        }
    },

    // builds a command in an ArrayBuffer
    // The first byte is always 7e (SYNC), 
    // the second byte is the command descriptor, 
    // the third and fourth bytes are a little-endian payload length.
    // then comes the payload, 
    // finally, it's followed with a 2-byte little-endian CRC of all the bytes
    // up to that point.
    // payload is any indexable array-like object that returns Numbers

    // Valid commands are:
    // SendEcho (6) 7e 05 00 00 CKL CKH  
    // QueryDevice (6) 7e 10 00 00 CKL CKH
    // RequestDisconnect (6) 7e 40 00 00 CKL CKH
    // SetBaud (7) 7e 70 01 00 BI CKL CKH  (BI values -- 1:9600 2: 19.2k 12: 115.2k, default is 9600)
    // RequestRecord (8) 7e 10 02 00 FI SQ CKL CKH (FI=File number 0-10, SQ=sequence 1=newest first, 0=oldest first)
    // Acknowledge (7) 7e 90 01 00 OK CKL CKH  (OK = 0:NAK, 1:ACK, 2:Stop sending)
    // Disconnect (6) 7e 40 00 00 CKL CKH

    buildPacket: function(descriptor, payloadLength, payload) {
        var buf = new ArrayBuffer(payloadLength + 6);
        var bytes = new Uint8Array(buf);
        bytes[0] = asanteDriver.SYNC_BYTE;
        bytes[1] = descriptor;
        bytes[2] = payloadLength & 0xFF;
        bytes[3] = (payloadLength >> 8) & 0xFF;
        for (var i=0; i < payloadLength; ++i) {
            bytes[4+i] = payload[i];
        }
        var crc = asanteDriver.calcCRC(bytes, payloadLength+4);
        bytes[4+payloadLength] = crc & 0xFF;
        bytes[5+payloadLength] = (crc >> 8) & 0xFF;
        return buf;
    }, 

    setBaudRate_pkt: function (rate) {
        var r = 0;
        for (var i in BAUDRATES) {
            // names and values don't overlap
            if (rate == i || rate == BAUDRATES[i].name || rate == BAUDRATES[i].value) {
                r = BAUDRATES[i].value;
                break;
            }
        }
        if (r === 0) {
            console.log("Bad baud rate specified: %d - using 9600", rate);
            r = 1;
        }
        return asanteDriver.buildPacket(0x70, 1, [r]);
    },

    queryDevice_pkt: function () {
        return asanteDriver.buildPacket(0x10, 0, null);
    },

    disconnect_pkt: function () {
        return asanteDriver.buildPacket(0x40, 0, null);
    },

    // rectype is 
    // newest_first is true if you want newest records first, false if you want oldest. 
    requestRecord_pkt: function (rectype, newest_first) {
        return asanteDriver.buildPacket(0x10, 2, [rectype, newest_first ? 1 : 0]);
    },

    // status is 0 for NAK (resend), 1 for ACK (send next), 2 for stop
    nextRecord_pkt: function (status) {
        return asanteDriver.buildPacket(0x90, 1, [status]);
    },

    // accepts a stream of bytes and tries to find an Asante packet
    // at the beginning of it.
    // returns a packet object; if valid == true it's a valid packet
    // if packet_len is nonzero, that much should be deleted from the stream
    // if valid is false and packet_len is nonzero, the previous packet 
    // should be NAKed.
    extractPacket: function(bytestream) {
        var bytes = new Uint8Array(bytestream);
        var packet = { 
            valid: false, 
            descriptor: 0, 
            payload_len: 0,
            payload: null, 
            crc: 0,
            packet_len: 0
        };

        if (bytes[0] != asanteDriver.SYNC_BYTE) {
            return packet;
        }

        plen = bytes.length;
        packet.descriptor = bytes[1];
        packet.payload_len = bytes[3] << 8 + bytes[2];
        if ((packet.payload_len + 6) < plen) {
            return packet;  // we're not done yet
        }

        // we now have enough length for a complete packet, so calc the CRC 
        packet._len = packet.payload_len + 6;
        var sentCRC = bytes[packet.payload_len + 6] << 8 + bytes[packet.payload_len + 5];
        packet.crc = sentCRC;
        var crc = asanteDriver.calcCRC(bytes, packet.payload_len + 6);
        if (crc != sentCRC) {
            // if the crc is bad, we should discard the whole packet
            // (packet_len is nonzero)
            return packet;
        }

        if (packet.payload_len) {
            packet.payload = new Uint8Array(packet.payload_len);        
            for (var i=0; i<packet.payload_len; ++i) {
                packet.payload[i] = bytes[i+4];
            }
        }

        packet.valid = true;
        return packet;
    },

    parsePacket: function(packet) {
        // var result = extractPacket(packet);

        var extractString = function(bytes, start, len) {
            s = "";
            for (var i=start; i<len; ++i) {
                s += String.fromCharCode(bytes[i]);
            }
            return s;
        };

        if (result.valid) {
            switch (result.descriptor) {
                case 0x01:
                    // this is the device probe response
                    result.pumpinfo = {
                        model: extractString(result.payload, 0, 4),
                        serialNumber: extractString(result.payload, 5, 11),
                        pumpRecordVersion: extractString(result.payload, 17, 2)
                    };
                    break;
                case 0x04:
                    // disconnect acknowledge
                    result.disconnected = true;
                    break;
                case 0x05:
                    // beacon
                    result.beacon = true;
                    break;
                case 0x06:
                    // nak
                    result.NAK = true;
                    result.errorcode = result.payload[0];
                    result.errormessage = [
                        "No sync byte",
                        "CRC mismatch",
                        "Illegal baud rate",
                        "Data query not linked to same record query.",
                        "Record number out of range",
                        "Order field out of range",
                        "Host ack code out of range",
                        "Message descriptor out of range"
                        ][result.errorcode];
                    break;
                case 0x07:
                    // baud rate set (this packet is sent, then the rate changes)
                    result.baudrateSet = true;
                    result.newBaudrate = result.payload[0];
                    break;
                case 0x08:
                    // data record response
                    result.datarecord = {
                        rectype: result.payload[0],
                        newest_first: result.payload[0] == 1 ? true : false,
                        data: result.payload.subarray(2)
                    };
                    break;
                case 0x09:
                    // end of data (response to EOF or end request)
                    result.dataEnd = true;
                    result.datarecord = {
                        rectype: result.payload[0]
                    };
                    break;
            }
        }
    }
};
