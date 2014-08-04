asanteDriver = function (config) {
    var cfg = config;

    var SYNC_BYTE = 0x7E;

    var BAUDRATES = {
        BAUD_9600: { value: 1, name: "9600"},
        BAUD_19200: { value: 2, name: "19200"},
        BAUD_28800: { value: 3, name: "28800"},
        BAUD_38400: { value: 4, name: "38400"},
        BAUD_48000: { value: 5, name: "48000"},
        BAUD_57600: { value: 6, name: "57600"},
        BAUD_96000: { value: 10, name: "96000"},
        BAUD_115200: { value: 12, name: "115200"}
    };

    var PUMP_DATA_RECORDS = {
        LOG_BOLUS: { value: 0, name: "Log Bolus", max: 450, type: "log" },
        LOG_SMART: { value: 1, name: "Log Smart", max: 450, type: "log" },
        LOG_BASAL: { value: 2, name: "Log Basal", max: 2232, type: "log" },
        LOG_BASAL_CONFIG: { value: 3, name: "Log Basal Config", max: 400, type: "log" },
        LOG_ALARM_ALERT: { value: 4, name: "Log Alarm Alert", max: 400, type: "log" },
        LOG_PRIME: { value: 5, name: "Log Prime", max: 128, type: "log" },
        LOG_PUMP: { value: 6, name: "Log Pump", max: 512, type: "log" },
        LOG_MISSED_BASAL: { value: 7, name: "Log Missed Basal", max: 256, type: "log" },
        LOG_TIME_EDIT: { value: 8, name: "Log Time Edits", max: 64, type: "log" },
        LOG_USER_SETTINGS: { value: 9, name: "Log User Settings", max: 1, type: "settings" },
        LOG_TIME_MANAGER_DATA: { value: 10, name: "Log Time Manager Data", max: 1, type: "settings" },
    };

    var DESCRIPTORS = {
        DEVICE_RESPONSE: { value: 0x01, name: "DeviceResponse"},
        DISCONNECT_ACK: { value: 0x04, name: "DisconnectAcknowledge"},
        BEACON: { value: 0x05, name: "Beacon"},
        NAK: { value: 0x06, name: "NAK"},
        BAUD_RATE_ACK: { value: 0x07, name: "BaudRateChanged"},
        RESPONSE_RECORD: { value: 0x08, name: "ResponseRecord"},
        EOF: { value: 0x09, name: "EOF"},
        QUERY_DEVICE: { value: 0x10, name: "QueryDevice"},
        DISCONNECT: { value: 0x40, name: "Disconnect"},
        SET_BAUD: { value: 0x70, name: "SetBaud"},
        REQUEST_RECORD: { value: 0x80, name: "RequestRecord"},
        REQUEST_NEXT: { value: 0x90, name: "RequestNext"},
    };

    var REPLY = {
        NAK: { value: 0, name: "ACK"},
        ACK: { value: 1, name: "NAK"},
        STOP: { value: 2, name: "STOP"},
    };

    var _getName = function(list, idx) {
        for (var i in list) {
            if (list[i].value == idx) {
                return list[i].name;
            }
        }
        return "UNKNOWN!";
    };

    var getDescriptorName = function(idx) {
        return _getName(DESCRIPTORS, idx);
    };

    var getReplyName = function(idx) {
        return _getName(REPLY, idx);
    };

    var getDataRecordName = function(idx) {
        return _getName(PUMP_DATA_RECORDS, idx);
    };

    var _timeState = {
        timeRecords: []
    };

    var _asanteBaseTime = new Date(2008, 0, 1, 0, 0, 0).valueOf();

    var convertRTCTime = function(t) {
        if (timeRecords[0]) {
            var time = t + 
                timeRecords[0].UserSetTime - 
                timeRecords[0].RtcAtSetTime;
            return time;
        }
        return t;
    };

    var humanReadableTime = function(t) {

        time = _asanteBaseTime + t * 1000;
        return new Date(time).toUTCString();

    };


    // builds a command in an ArrayBuffer
    // The first byte is always 7e (SYNC), 
    // the second byte is the command descriptor, 
    // the third and fourth bytes are a little-endian payload length.
    // then comes the payload, 
    // finally, it's followed with a 2-byte little-endian CRC of all the bytes
    // up to that point.
    // payload is any indexable array-like object that returns Numbers

    var buildPacket = function(descriptor, payloadLength, payload) {
        var buf = new ArrayBuffer(payloadLength + 6);
        var bytes = new Uint8Array(buf);
        var ctr = util.pack(bytes, 0, "bbs", SYNC_BYTE,
            descriptor, payloadLength);
        ctr += util.copyBytes(bytes, ctr, payload, payloadLength);
        var crc = crcCalculator.calcAsanteCRC(bytes, ctr);
        util.pack(bytes, ctr, "s", crc);
        console.log(bytes);
        return buf;
    }; 

    var setBaudRate_pkt = function (rate) {
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
        return buildPacket(DESCRIPTORS.SET_BAUD.value, 1, [r]);
    };

    var queryDevice_pkt = function () {
        return buildPacket(DESCRIPTORS.QUERY_DEVICE.value, 0, null);
    };

    var disconnect_pkt = function () {
        return buildPacket(DESCRIPTORS.DISCONNECT.value, 0, null);
    };

    // rectype is 
    // newest_first is true if you want newest records first, false if you want oldest. 
    var requestRecord_pkt = function (rectype, newest_first) {
        return buildPacket(DESCRIPTORS.REQUEST_RECORD.value, 2, 
            [rectype, newest_first ? 1 : 0]);
    };

    // status is 0 for NAK (resend), 1 for ACK (send next), 2 for stop
    var request_next_pkt = function (status) {
        return buildPacket(
            DESCRIPTORS.REQUEST_NEXT.value, 1, [status]);
    };

    var nak_pkt = function () {
        return request_next_pkt(REPLY.NAK.value);
    };

    var ack_pkt = function () {
        return request_next_pkt(REPLY.ACK.value);
    };

    var stop_pkt = function () {
        return request_next_pkt(REPLY.STOP.value);
    };

    var queryDevice = function() {
        return {
            packet: queryDevice_pkt(),
            parser: parsePacket
        };
    };

    var requestRecord = function(rectype, oldest_first) {
        // var pkt = requestRecord_pkt(rectype, oldest_first);
        // var bytes = new Uint8Array(pkt);
        // console.log(bytes);
        return {
            packet: requestRecord_pkt(rectype, oldest_first),
            parser: parsePacket
        };
    };

    var nextRecord = function() {
        return {
            packet: ack_pkt(),
            parser: parsePacket
        };
    };

    var setBaudRate = function() {
        return {
            packet: setBaudRate_pkt(9600),
            parser: parsePacket
        };
    };

    // accepts a stream of bytes and tries to find an Asante packet
    // at the beginning of it. In no case should there be fewer than 6 bytes
    // in the bytestream.
    // returns a packet object; if valid == true it's a valid packet
    // if packet_len is nonzero, that much should be deleted from the stream
    // if valid is false and packet_len is nonzero, the previous packet 
    // should be NAKed.
    var extractPacket = function(bytestream) {
        var bytes = new Uint8Array(bytestream);
        var packet = { 
            valid: false, 
            sync: 0,
            descriptor: 0, 
            payload_len: 0,
            payload: null, 
            crc: 0,
            packet_len: 0
        };

        plen = bytes.length;        // this is how many bytes we've been handed
        if (plen < 6) {             // if we don't have at least 6 bytes, don't bother
            return packet;
        }

        // we know we have at least enough to check the packet header, so do that
        util.unpack(bytes, 0, "bbs", ["sync", "descriptor", "payload_len"], packet);

        // if the first byte isn't our sync byte, then just discard that 
        // one byte and let our caller try again.
        if (packet.sync != SYNC_BYTE) {
            packet.packet_len = 1;
            return packet;
        }

        var need_len = packet.payload_len + 6;
        if (need_len > plen) {
            return packet;  // we don't have enough yet so go back for more
        }
        packet.packet_len = need_len;

        // we now have enough length for a complete packet, so calc the CRC 
        packet.crc = util.extractShort(bytes, packet.packet_len - 2);
        var crc = crcCalculator.calcAsanteCRC(bytes, packet.packet_len - 2);
        if (crc != packet.crc) {
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
    };

    var parsePacket = function(packet) {
        if (packet.valid) {
            switch (packet.descriptor) {
                case DESCRIPTORS.DEVICE_RESPONSE.value:
                    packet.pumpinfo = {
                        model: util.extractString(packet.payload, 0, 4),
                        serialNumber: util.extractString(packet.payload, 5, 11),
                        // asante docs say that pumpRecordVersion is a 2-character
                        // ascii string, and the example in the documentation says '60', 
                        // but the pump I have returns the two characters 0x00 and 0x45, 
                        // which is either the decimal value 17664, a null and the letter E,
                        // or a bug in either the documentation or this version of the pump.
                        // for now, I'm going to treat it as a short.
                        pumpRecordVersion: util.extractShort(packet.payload, 17, 2)
                    };
                    break;
                case DESCRIPTORS.DISCONNECT_ACK.value:
                    packet.disconnected = true;
                    break;
                case DESCRIPTORS.BEACON.value:
                    packet.beacon = true;
                    packet.lastbeacon = Date.now();
                    break;
                case DESCRIPTORS.NAK.value:
                    packet.NAK = true;
                    packet.errorcode = packet.payload[0];
                    packet.errormessage = [
                        "No sync byte",
                        "CRC mismatch",
                        "Illegal baud rate",
                        "Data query not linked to same record query.",
                        "Record number out of range",
                        "Order field out of range",
                        "Host ack code out of range",
                        "Message descriptor out of range"
                        ][packet.errorcode];
                    break;
                case DESCRIPTORS.BAUD_RATE_ACK.value:
                    // baud rate set (this packet is sent, then the rate changes)
                    packet.baudrateSet = true;
                    packet.newBaudrate = packet.payload[0];
                    break;
                case DESCRIPTORS.RESPONSE_RECORD.value:
                    // data record response
                    packet.datarecord = {
                        rectype: packet.payload[0],
                        newest_first: packet.payload[0] == 1 ? true : false,
                        data: packet.payload.subarray(2)
                    };
                    unpackDataRecord(packet.datarecord);
                    break;
                case DESCRIPTORS.EOF.value:
                    // end of data (response to EOF or end request)
                    packet.dataEnd = true;
                    packet.datarecord = {
                        rectype: packet.payload[0]
                    };
                    break;
            }
        }
        return packet;
    };

    var unpackDataRecord = function(rec) {
        switch (rec.rectype) {
            case PUMP_DATA_RECORDS.LOG_BOLUS.value:
                util.unpack(rec.data, 0, "siissssibbbbbb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "BolusID",
                    "ClicksDelivered",
                    "NowClicksRequested",
                    "TimedClicksRequested",
                    "EndTime",
                    "Type",
                    "CompletionCode",
                    "duration15MinUnits",
                    "SmartBolus",
                    "SmartTotalOverride",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_SMART.value:
                util.unpack(rec.data, 0, "siisssisssssssbb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "BolusID",
                    "CurrentBG",
                    "FoodCarbs",
                    "IOB",
                    "IOBMode",
                    "TotalInsulin",
                    "GrossBGInsulin",
                    "GrossCarbInsulin",
                    "NetBGInsulin",
                    "NetCarbInsulin",
                    "CarbInsulinPercent",
                    "BolusDelivered",
                    "TotalOverride"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_BASAL.value:
                util.unpack(rec.data, 0, "siibb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "ClicksDelivered",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_BASAL_CONFIG.value:
                util.unpack(rec.data, 0, "siibb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "EventType",
                    "Pad1"
                    ], rec);
                    // some conditional code goes here based on EventType
                break;
            case PUMP_DATA_RECORDS.LOG_ALARM_ALERT.value:
                util.unpack(rec.data, 0, "siibssbb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "AckTime",
                    "Qualifier1",
                    "Qualifier2",
                    "Event",        // missing list of event types (MsgTypes)
                    "AckCause"      // missing list of ac_ClearCondition
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_PRIME.value:
                util.unpack(rec.data, 0, "siissbb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "ClicksRequested",
                    "ClicksDelivered",
                    "CompletionCode",
                    "Type"      // missing list of PrimeTypes
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_PUMP.value:
                util.unpack(rec.data, 0, "siiiisbb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "pbSerNumCm",
                    "pbSerNumRtc",
                    "InsulinVolume",
                    "ConnectionType",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_MISSED_BASAL.value:
                util.unpack(rec.data, 0, "siiisbb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "StartOfSuspension",
                    "ClicksMissed",
                    "ReasonForStopping",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_TIME_EDIT.value:
                util.unpack(rec.data, 0, "siiiibb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "UserSetTime",
                    "Flags",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_TIME_MANAGER_DATA.value:
                util.unpack(rec.data, 0, "siis", [
                    "crc",
                    "RtcAtSetTime",
                    "UserSetTime",
                    "userTimeFlag"
                    ], rec);
                rec.hrRTC = humanReadableTime(rec.RtcAtSetTime);
                rec.hrUserTime = humanReadableTime(rec.UserSetTime);
                console.log(rec.hrRTC);
                console.log(rec.hrUserTime);
                _timeState.timeRecords.push({
                    RtcAtSetTime: rec.RtcAtSetTime,
                    UserSetTime: rec.UserSetTime,
                    userTimeFlag: rec.userTimeFlag
                });
                break;
            case PUMP_DATA_RECORDS.LOG_USER_SETTINGS.value:
                up = util.createUnpacker().
                    add("ssbbb", ["record", "crc", "SmartBolusEnable",
                        "SmartBolusInitialized", "BGUnitsType"]);
                var i;
                for (i=0; i<7; i++) {
                    up.add("ss", ["FoodProfileStartTime_" + i,
                        "FoodProfileCarbRatio_" + i]);
                }
                for (i=0; i<3; i++) {
                    up.add("ss", ["BGProfileStartTime_" + i,
                        "BGProfileBGRatio_" + i]);
                }
                for (i=0; i<3; i++) {
                    up.add("ss", ["TargetBGStartTime_" + i,
                        "TargetBGMinBG_" + i,
                        "TargetBGMaxBG_" + i]);
                }
                up.add("bbbbbbbsb", [
                    "IOBMode",
                    "BolusButtonSelect",
                    "ComboBolusEnable",
                    "TimedBolusEnable",
                    "BolusReminderEnable",
                    "BolusStepSize",
                    "AudioBolusStepSize",
                    "BolusLimit",
                    "ActiveProfile"
                    ]);
                up.go(rec.data, 0, rec);
                break;
        }
    };

    var handleAsante = function(handleArray) {
        // unless there are multiple serial cables plugged in, handleArray should 
        // have just one entry; for now just use the first one.
        console.log(handleArray);
        var h = handleArray[0];
    };

    var findAsante = function() {
        var manifest = chrome.runtime.getManifest();
        for (var p = 0; p < manifest.permissions.length; ++p) {
            var perm = manifest.permissions[p];
            if (perm.usbDevices) {
                for (d = 0; d < perm.usbDevices.length; ++d) {
                    var prefix = 'Asante SNAP';
                    if (perm.usbDevices[d].deviceName.slice(0, prefix.length) === prefix) {
                        chrome.usb.findDevices({
                            vendorId: perm.usbDevices[d].vendorId,
                            productId: perm.usbDevices[d].productId
                        }, handleAsante);
                    }
                }
            }
        }
    };

    // When you call this, it looks to see if a complete Asante packet has
    // arrived and it calls the callback with it and strips it from the buffer. 
    // It returns true if a packet was found, and false if not.
    var readAsantePacket = function(callback) {
        // for efficiency reasons, we're not going to bother to ask the driver
        // to decode things that can't possibly be a packet
        // first, discard bytes that can't start a packet
        var discardCount = 0;
        while (cfg.deviceComms.buffer.length > 0 && cfg.deviceComms.buffer[0] != SYNC_BYTE) {
            ++discardCount;
        }
        if (discardCount) {
            cfg.deviceComms.discardBytes(discardCount);
        }

        if (cfg.deviceComms.buffer.length < 6) { // all complete packets must be this long
            // console.log("packet not long enough (%d)", cfg.deviceComms.buffer.length);
            return false;       // not enough there yet
        }

        // there's enough there to try, anyway
        var packet = extractPacket(cfg.deviceComms.buffer);
        if (packet.packet_len !== 0) {
            // remove the now-processed packet
            cfg.deviceComms.discardBytes(packet.packet_len);
        }
        if (packet.valid) {
            callback(null, packet);
        }
        return true;
    };

    // callback gets a result packet modified by parsing the payload
    var asanteCommandResponse = function(commandpacket, callback) {
        var processResult = function(err, result) {
            if (err) {
                callback(err, result);
                return;
            }
            // console.log(result);
            if (result.payload) {
                commandpacket.parser(result);
            }
            if (result.valid) {
                callback(null, result);
            } else {
                callback("Response from pump didn't parse properly!", result);
            }
        };

        var waitloop = function(count) {
            if (count > 10) {
                processResult("TIMEOUT", null);
            }
            if (!readAsantePacket(processResult)) {
                console.log('-');
                setTimeout(waitloop(count + 1), 100);
            }
        };

        var p = new Uint8Array(commandpacket.packet);
        console.log(p);
        cfg.deviceComms.writeSerial(commandpacket.packet, function() {
            console.log("->");
            waitloop(0);
        });
    };

    var listenForBeacon = function(callback) {
        var processResult = function(err, result) {
            if (err) {
                callback(err, result);
                return true;
            }
            result.parsed_payload = parsePacket(result);
            if (result.valid) {
                callback(null, result);
                return true;
            }
            return false;
        };

        var abortTimer = setTimeout(function() {
            clearInterval(listenTimer);
            console.log("timeout");
            callback("timeout", null);
        }, 5000);

        var listenTimer = setInterval(function() {
            if (readAsantePacket(processResult)) {
                console.log("completed");
                clearTimeout(abortTimer);
            }
        }, 100);

    };

    // callback is called when EOF happens with all records retrieved
    var asanteDownloadRecords = function(recordtype, callback) {
        var cmd = requestRecord(recordtype, false);
        var retval = [];
        console.log("requesting recordtypes %s", getDataRecordName(recordtype));
        function iterate(err, result) {
            if (err) {
                callback(err, result);
            }
            if (result.valid) {
                if (result.descriptor == DESCRIPTORS.RESPONSE_RECORD.value) {
                    // process record
                    retval.push(result);
                    // console.log(result);
                    // request next record
                    next = nextRecord();
                    asanteCommandResponse(next, iterate);
                } else if (result.descriptor == DESCRIPTORS.EOF.value) {
                    console.log("Got EOF!");
                    callback(null, retval);
                } else if (result.descriptor == DESCRIPTORS.BEACON.value) {
                    // just try resending the command
                    asanteCommandResponse(cmd, iterate);
                } else {
                    console.log("BAD RESULT");
                    console.log(result);
                    callback(result, null);
                }
            }
        }

        asanteCommandResponse(cmd, iterate);
    };

    // callback is called when EOF happens with all records retrieved
    var asanteGetHeader = function(callback) {
        var cmd = queryDevice();
        console.log("requesting header");
        function iterate(err, result) {
            if (err) {
                if (err === "TIMEOUT") {
                    console.log("recursing!");
                    asanteGetHeader(callback);
                    return;
                } else {
                    callback(err, result);
                }
            }
            if (result.valid) {
                if (result.descriptor == DESCRIPTORS.DEVICE_RESPONSE.value) {
                    console.log("asante header");
                    deviceInfo = result.pumpinfo;
                    console.log(null, result);
                    callback(null, deviceInfo);
                } else if (result.descriptor == DESCRIPTORS.BEACON.value) {
                    // just try resending the command after a half-second pause
                    console.log("retrying");
                    asanteCommandResponse(cmd, iterate);
                } else {
                    console.log("BAD RESULT");
                    console.log(result);
                    callback(result, null);
                }
            }
        }

        asanteCommandResponse(cmd, iterate);
    };

    var _progress = 0;
    var logProg = function(cb) {
        console.log("Progress = %d", _progress);
        _progress++;
        cb(null, _progress);
    };

    var asanteConnect = function() {
        var cmd = queryDevice();
        async.series([
            logProg,
            asanteGetHeader,
            logProg,
            asanteDownloadRecords.bind(null, 
                PUMP_DATA_RECORDS.LOG_TIME_MANAGER_DATA.value),
            logProg,
            asanteDownloadRecords.bind(null, 
                PUMP_DATA_RECORDS.LOG_BOLUS.value),
            logProg,
            asanteDownloadRecords.bind(null, 
                PUMP_DATA_RECORDS.LOG_BASAL.value),
            logProg
            ],
            function(err, results) {
                if (err) {
                    console.log("ERROR!");
                    console.log(err);
                } else {
                    console.log("SUCCESS!");
                    console.log(results);
                }
            });

    };

    var xxxlistenForBeacon = function () {
        listenForBeacon(function (e, r) {
            console.log("heard beacon!");
            asanteConnect();
        });
    };

    var asanteSetBaudRate = function() {
        asanteCommandResponse(setBaudRate(), function(err, result) {
            console.log(result);
            if (err) {
                console.log("Error setting baud rate.");
            } else {
                console.log("baud rate set to %s", result.newBaudrate);
            }
        });
    };

    return {
        // should call the callback with null, obj if the item 
        // was detected, with null, null if not detected.
        // call err only if there's something unrecoverable.
        detect: function (obj, cb) {
            console.log('looking for asante');
            listenForBeacon(function(err, result) {
                if (err) {
                    if (err == "timeout") {
                        cb(null, null);
                    } else {
                        cb(err, result);
                    }
                } else {
                    cb(null, obj);
                }
            });
        },

        setup: function (progress, cb) {
            progress(100);
            cb(null, "setup");
        },

        connect: function (progress, cb) {
            progress(100);
            cb(null, "connect");
        },

        getConfigInfo: function (progress, cb) {
            progress(100);
            cb(null, "getConfigInfo");
        },

        fetchData: function (progress, cb) {
            progress(100);
            cb(null, "fetchData");
        },

        processData: function (progress, cb) {
            progress(40);
            setTimeout(function() {
                progress(100);
                cb(null, "processData");
            }, Math.random() * 10000);
        },

        uploadData: function (progress, cb) {
            progress(100);
            cb(null, "uploadData");
        },

        disconnect: function (progress, cb) {
            progress(100);
            cb(null, "disconnect");
        },

        cleanup: function (progress, cb) {
            progress(100);
            cb(null, "cleanup");
        }
    };
};
