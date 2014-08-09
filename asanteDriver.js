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

    var BOLUS_TYPE = {
        NOW: { value: 0, name: "NOW"},
        TIMED: { value: 1, name: "TIMED"},
        COMBO: { value: 2, name: "COMBO"},
    };

    var CLICKS_TO_UNITS = 0.05; // number of units in a "click" of the pump
    var BG_CONVERSION = 0.10; // values in the pump are 10x what the actual BG number is

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
        if (_timeState.timeRecords.length > 1) {
            console.log("WARNING -- there are more than 1 time records - timestamps may be wrong.");
        }
        if (_timeState.timeRecords[0]) {
            var time = t + 
                _timeState.timeRecords[0].UserSetTime - 
                _timeState.timeRecords[0].RtcAtSetTime;
            return time;
        }
        return t;
    };

    var humanReadableTime = function(t) {

        var time = _asanteBaseTime + t * cfg.timeutils.SEC_TO_MSEC;
        return new Date(time).toUTCString();

    };

    var getDeviceTime = function(t) {

        var atime = _asanteBaseTime + t * cfg.timeutils.SEC_TO_MSEC;
        var time = convertRTCTime(atime);
        return new Date(time).toISOString().slice(0, -5);   // trim off the .000z

    };

    var getUTCTime = function(t) {

        var atime = _asanteBaseTime + t * cfg.timeutils.SEC_TO_MSEC - 
            cfg.tz_offset_minutes * cfg.timeutils.MIN_TO_MSEC;
        var time = convertRTCTime(atime);
        return new Date(time).toISOString();

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
        var ctr = struct.pack(bytes, 0, "bbs", SYNC_BYTE,
            descriptor, payloadLength);
        ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
        var crc = crcCalculator.calcAsanteCRC(bytes, ctr);
        struct.pack(bytes, ctr, "s", crc);
        // console.log(bytes);
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

    var stopSending = function() {
        return {
            packet: stop_pkt(),
            parser: parsePacket
        };
    };

    var setBaudRate = function() {
        return {
            packet: setBaudRate_pkt(9600),
            parser: parsePacket
        };
    };

    var disconnect = function() {
        return {
            packet: disconnect_pkt(9600),
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
    var extractPacket = function(bytes) {
        var packet = { 
            valid: false, 
            sync: 0,
            descriptor: 0, 
            payload_len: 0,
            payload: null, 
            crc: 0,
            packet_len: 0
        };

        var plen = bytes.length;        // this is how many bytes we've been handed
        if (plen < 6) {             // if we don't have at least 6 bytes, don't bother
            return packet;
        }

        // we know we have at least enough to check the packet header, so do that
        struct.unpack(bytes, 0, "bbs", ["sync", "descriptor", "payload_len"], packet);

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
        packet.crc = struct.extractShort(bytes, packet.packet_len - 2);
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
                        model: struct.extractString(packet.payload, 0, 4),
                        serialNumber: struct.extractString(packet.payload, 5, 11),
                        // asante docs say that pumpRecordVersion is a 2-character
                        // ascii string, and the example in the documentation says '60', 
                        // but the pump I have returns the two characters 0x00 and 0x45, 
                        // which is either the decimal value 17664, a null and the letter E,
                        // or a bug in either the documentation or this version of the pump.
                        // for now, I'm going to treat it as a short.
                        pumpRecordVersion: struct.extractShort(packet.payload, 17, 2)
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
                struct.unpack(rec.data, 0, "siissssibbbbbb", [
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
                struct.unpack(rec.data, 0, "s2i3sn7s2b", [
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
                struct.unpack(rec.data, 0, "siibb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "ClicksDelivered",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_BASAL_CONFIG.value:
                struct.unpack(rec.data, 0, "siibb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "EventType",
                    "Pad1"
                    ], rec);
                    // some conditional code goes here based on EventType
                break;
            case PUMP_DATA_RECORDS.LOG_ALARM_ALERT.value:
                struct.unpack(rec.data, 0, "siibssbb", [
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
                struct.unpack(rec.data, 0, "siissbb", [
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
                struct.unpack(rec.data, 0, "siiiisbb", [
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
                struct.unpack(rec.data, 0, "siiisbb", [
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
                struct.unpack(rec.data, 0, "siiiibb", [
                    "crc",
                    "DateTime",
                    "SeqNmbr",
                    "UserSetTime",
                    "Flags",
                    "Pad"
                    ], rec);
                break;
            case PUMP_DATA_RECORDS.LOG_TIME_MANAGER_DATA.value:
                struct.unpack(rec.data, 0, "siis", [
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
                var up = struct.createUnpacker().
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

    var asantePacketHandler = function(buffer) {
        // first, discard bytes that can't start a packet
        var discardCount = 0;
        while (buffer.len() > 0 && buffer.get(0) != SYNC_BYTE) {
            ++discardCount;
        }
        if (discardCount) {
            buffer.discard(discardCount);
        }

        if (buffer.len() < 6) { // all complete packets must be at least this long
            return null;       // not enough there yet
        }

        // there's enough there to try, anyway
        var packet = extractPacket(buffer.bytes());
        if (packet.packet_len !== 0) {
            // remove the now-processed packet
            buffer.discard(packet.packet_len);
        }

        if (packet.valid) {
            return packet;
        } else {
            return null;
        }
    };

    var listenForPacket = function (timeout, ignoreBeacons, callback) {
        var abortTimer = setTimeout(function() {
            clearInterval(listenTimer);
            console.log("TIMEOUT");
            callback("TIMEOUT", null);
        }, timeout);

        var listenTimer = setInterval(function() {
            if (cfg.deviceComms.hasAvailablePacket()) {
                var pkt = cfg.deviceComms.nextPacket();
                // if we sent a command, ignore all beacons (they may have been
                // left in the buffer before we started). 
                if (pkt.valid && (!ignoreBeacons || 
                        pkt.descriptor !== DESCRIPTORS.BEACON.value)) {
                    clearTimeout(abortTimer);
                    clearInterval(listenTimer);
                    parsePacket(pkt);
                    callback(null, pkt);
                }
            }
        }, 20);     // spin on this one quickly
    };

    var asanteCommandResponse = function(commandpacket, callback) {
        var p = new Uint8Array(commandpacket.packet);
        console.log(p);
        cfg.deviceComms.writeSerial(commandpacket.packet, function() {
            // once we've sent the command, start listening for a response
            // but if we don't get one in 1 second give up
            listenForPacket(1000, true, callback);
        });
    };

    var listenForBeacon = function(callback) {
        listenForPacket(6000, false, callback);
    };

    // callback is called when EOF happens with all records retrieved
    var asanteDownloadRecords = function(recordtype, callback) {
        var cmd = requestRecord(recordtype, false);
        var retval = [];
        console.log("requesting recordtypes %s", getDataRecordName(recordtype));
        function iterate(err, result) {
            if (err) {
                console.log("error in iterate");
                callback(err, result);
            }
            if (result.valid) {
                if (result.descriptor == DESCRIPTORS.RESPONSE_RECORD.value) {
                    // process record
                    retval.push(result.datarecord);
                    // console.log(result);
                    // request next record
                    var next = nextRecord();
                    if (retval.length >= 3000) {    // 3000 is bigger than any log's capacity
                        next = stopSending();
                        console.log("cutting it short for debugging!");                        
                    }
                    asanteCommandResponse(next, iterate);
                } else if (result.descriptor == DESCRIPTORS.EOF.value) {
                    console.log("Got EOF!");
                    callback(null, retval);
                } else {
                    console.log("BAD RESULT");
                    console.log(result);
                    callback(result, null);
                }
            }
        }

        asanteCommandResponse(cmd, iterate);
    };

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
                if (result.descriptor === DESCRIPTORS.DEVICE_RESPONSE.value) {
                    console.log("asante header");
                    var deviceInfo = result.pumpinfo;
                    console.log(result);
                    callback(null, deviceInfo);
                } else {
                    console.log("BAD RESULT");
                    console.log(result);
                    callback(result, null);
                }
            }
        }

        asanteCommandResponse(cmd, iterate);
    };

    var asanteFetch = function(progress, callback) {
        var getRecords = function (rectype, progressLevel) {
            return function(callback) {
                console.log("in serial event ", rectype, progressLevel);
                asanteDownloadRecords(rectype, function(err, result) {
                    console.log("fetch progress + " + progressLevel);
                    console.log(err);
                    console.log(result);
                    progress(progressLevel);
                    callback(err, result);
                });
            };
        };

        async.series([
            getRecords(PUMP_DATA_RECORDS.LOG_TIME_MANAGER_DATA.value, 30),
            getRecords(PUMP_DATA_RECORDS.LOG_BOLUS.value, 50),
            getRecords(PUMP_DATA_RECORDS.LOG_SMART.value, 70),
            getRecords(PUMP_DATA_RECORDS.LOG_BASAL.value, 90)
            ],
            function (err, result) {
                console.log("asanteFetch");
                if (err) {
                    console.log(err);
                    callback(err, result);
                } else {
                    var retval = {
                        timeManager: result[0],
                        bolusRecords: result[1],
                        smartRecords: result[2],
                        basalRecords: result[3]
                    };
                    callback(null, retval);
                }
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

    var asanteDisconnect = function(callback) {
        return callback(null, "not disconnected");
        // asanteCommandResponse(disconnect(), function(err, result) {
        //     if (err) {
        //         console.log("Error disconnecting.");
        //     } else {
        //         console.log("Disconnected.");
        //     }
        //     callback(err, result);
        // });
    };

    // note -- this puts a bolus record hash into data
    var asanteBuildBolusRecords = function(data) {
        var postrecords = [];
        data.bolusIndexHash = {};
        for (var i=0; i<data.bolusRecords.length; ++i) {
            var b = data.bolusRecords[i];
            b.unitsDelivered = b.ClicksDelivered * CLICKS_TO_UNITS;
            b.deviceTime = getDeviceTime(b.DateTime);
            b.UTCTime = getUTCTime(b.DateTime);
            b.duration_msec = b.duration15MinUnits * 15 * cfg.timeutils.MIN_TO_MSEC;

            var rec;
            if (b.Type === BOLUS_TYPE.NOW.value) {
                b.textType = BOLUS_TYPE.NOW.name;
                rec = cfg.jellyfish.buildNormalBolus(b.unitsDelivered, b.UTCTime, b.deviceTime);
            } else if (b.Type === BOLUS_TYPE.TIMED.value) {
                b.textType = BOLUS_TYPE.TIMED.name;
                rec = cfg.jellyfish.buildSquareBolus(b.unitsDelivered, b.duration_msec, 
                    b.UTCTime, b.deviceTime);
            } else if (b.Type === BOLUS_TYPE.COMBO.value) {
                b.textType = BOLUS_TYPE.COMBO.name;
                // this is to calculate the split for extended boluses in case it didn't all
                // get delivered
                var normalRequested = b.NowClicksRequested * CLICKS_TO_UNITS;
                var extendedRequested = b.TimedClicksRequested * CLICKS_TO_UNITS;
                b.normalUnits = Math.min(b.unitsDelivered, normalRequested);
                b.extendedUnits = b.unitsDelivered - b.normalUnits;
                rec = cfg.jellyfish.buildDualBolus(b.normalUnits, b.extendedUnits, b.duration_msec, 
                    b.UTCTime, b.deviceTime);
            }
            data.bolusIndexHash[b.BolusID] = rec[0];
            postrecords.push(rec);
        }
        // flatten only the top layer
        postrecords = _.flatten(postrecords, true);
        return postrecords;
    };

    var asanteBuildWizardRecords = function(data) {
        var postrecords = [];
        for (var i=0; i<data.smartRecords.length; ++i) {
            var wz = data.smartRecords[i];
            wz.unitsCalculated = wz.TotalInsulin * CLICKS_TO_UNITS;
            wz.bg = wz.CurrentBG * BG_CONVERSION;
            wz.deviceTime = getDeviceTime(wz.DateTime);
            wz.UTCTime = getUTCTime(wz.DateTime);
            wz.carbInput = wz.FoodCarbs;
            var refBolus = data.bolusIndexHash[wz.BolusID] || null;

            var rec = cfg.jellyfish.buildWizard(
                wz.unitsCalculated,
                wz.bg,
                refBolus,
                wz,
                wz.UTCTime,
                wz.deviceTime
                );

            postrecords.push(rec);
        }
        return postrecords;
    };

    var asanteXXX = function(callback) {
        callback(null, "XXX");
    };

    var _enabled = false;

    return {
        enable: function() {
            _enabled = true;
        },

        disable: function() {
            _enabled = false;
        },

        // should call the callback with null, obj if the item 
        // was detected, with null, null if not detected.
        // call err only if there's something unrecoverable.
        detect: function (obj, cb) {
            if (_enabled === false) {
                console.log("Asante driver is disabled!");
                return cb(null, null);
            }
            console.log("looking for asante", obj);
            cfg.deviceComms.setPacketHandler(asantePacketHandler);

            cfg.deviceComms.flush();
            listenForBeacon(function(err, result) {
                if (err) {
                    if (err == "TIMEOUT") {
                        console.log("beacon timeout");
                        cb(null, null);
                    } else {
                        cb(err, result);
                    }
                } else {
                    console.log("found beacon");
                    cb(null, obj);
                }
            });
            cfg.deviceComms.flush();
        },

        setup: function (progress, cb) {
            console.log("in setup");
            progress(100);
            var data = {stage: "setup"};
            cb(null, data);
        },

        connect: function (progress, data, cb) {
            console.log("in connect");
            progress(100);
            data.stage = "connect";
            cb(null, data);
        },

        getConfigInfo: function (progress, data, cb) {
            console.log("in getConfigInfo");
            progress(0);
            asanteGetHeader(function(err, result) {
                data.stage = "getConfigInfo";
                progress(100);
                data.pumpHeader = result;
                if (err) {
                    return cb(err, data);
                } else {
                    cfg.jellyfish.setDeviceInfo( {
                        deviceId: "Asante " + result.model + " " + result.serialNumber,
                        source: "device",
                        timezoneOffset: cfg.tz_offset_minutes,
                        units: "mg/dL"      // everything we report is in this unit
                    });
                    
                    return cb(null, data);
                }
            });
        },

        fetchData: function (progress, data, cb) {
            console.log("in fetchData");
            progress(0);
            asanteFetch(progress, function(err, result) {
                console.log("fetchData callback");
                progress(100);
                data.stage = "fetchData";
                data = _.assign(data, result);
                if (err) {
                    return cb(err, data);
                } else {
                    cb(null, data);
                }
            });
        },

        processData: function (progress, data, cb) {
            console.log("in processData");
            progress(0);
            asanteXXX(function(err, result) {
                progress(100);
                data.stage = "processData";
                data.processData = result;
                if (err) {
                    return cb(err, data);
                } else {
                    cb(null, data);
                }
            });
        },

        uploadData: function (progress, data, cb) {
            console.log("in uploadData");
            data.stage = "uploadData";
            progress(0);
            data.upload_records = asanteBuildBolusRecords(data);
            var wizards = asanteBuildWizardRecords(data);
            data.upload_records = data.upload_records.concat(wizards);
            console.log(data.upload_records);

            cfg.jellyfish.post(data.upload_records, progress, function(err, results) {
                if (err) {
                    console.log(err);
                    console.log(results);
                    progress(100);
                    return cb(err, data);
                } else {
                    progress(100);
                    return cb(null, data);
                }
            });
        },

        disconnect: function (progress, data, cb) {
            console.log("in disconnect");
            progress(0);
            asanteDisconnect(function(err, result) {
                progress(100);
                data.stage = "disconnect";
                data.disconnect = result;
                if (err) {
                    return cb(err, data);
                } else {
                    cb(null, data);
                }
            });
        },

        cleanup: function (progress, data, cb) {
            console.log("in cleanup");
            progress(0);
            cfg.deviceComms.clearPacketHandler();
            asanteXXX(function(err, result) {
                progress(100);
                data.stage = "cleanup";
                data.cleanup = result;
                if (err) {
                    return cb(err, data);
                } else {
                    cb(null, data);
                }
            });
        }
    };
};
