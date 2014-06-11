var asanteDriver = {
    SYNC_BYTE: 0x7E,

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
        var crc = crcCalculator.calcAsanteCRC(bytes, payloadLength+4);
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
        packet.payload_len = (bytes[3] << 8) + bytes[2];
        if ((packet.payload_len + 6) < plen) {
            return packet;  // we're not done yet
        }

        // we now have enough length for a complete packet, so calc the CRC 
        packet._len = packet.payload_len + 6;
        var sentCRC = (bytes[packet.payload_len + 6] << 8) + bytes[packet.payload_len + 5];
        packet.crc = sentCRC;
        var crc = crcCalculator.calcAsanteCRC(bytes, packet.payload_len + 6);
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
