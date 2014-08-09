dexcomDriver = function(config) {
    var cfg = _.clone(config);
    var serialDevice = config.deviceComms;

    var SYNC_BYTE = 0x01;

    var CMDS = {
        NULL: { value: 0, name: "NULL" },
        ACK: { value: 1, name: "ACK" },
        NAK: { value: 2, name: "NAK" },
        INVALID_COMMAND: { value: 3, name: "INVALID_COMMAND" },
        INVALID_PARAM: { value: 4, name: "INVALID_PARAM" },
        INCOMPLETE_PACKET_RECEIVED: { value: 5, name: "INCOMPLETE_PACKET_RECEIVED" },
        RECEIVER_ERROR: { value: 6, name: "RECEIVER_ERROR" },
        INVALID_MODE: { value: 7, name: "INVALID_MODE" },
        READ_FIRMWARE_HEADER: { value: 11, name: "Read Firmware Header" },
        READ_DATA_PAGE_RANGE: { value: 16, name: "Read Data Page Range" },
        READ_DATA_PAGES: { value: 17, name: "Read Data Pages" },
        READ_DATA_PAGE_HEADER: { value: 18, name: "Read Data Page Header" }
    };

    var RECORD_TYPES = {
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
    };

    var TRENDS = {
        NONE: { value: 0, name: "None" },
        DOUBLEUP: { value: 1, name: "DoubleUp" },
        SINGLEUP: { value: 2, name: "SingleUp" },
        FORTYFIVEUP: { value: 3, name: "FortyFiveUp" },
        FLAT: { value: 4, name: "Flat" },
        FORTYFIVEDOWN: { value: 5, name: "FortyFiveDown" },
        SINGLEDOWN: { value: 6, name: "SingleDown" },
        DOUBLEDOWN: { value: 7, name: "DoubleDown" },
        NOTCOMPUTABLE: { value: 8, name: "Not Computable" },
        RATEOUTOFRANGE: { value: 9, name: "Rate Out Of Range" }
    };

    var BASE_DATE_DEVICE = cfg.timeutils.buildMsec({ year: 2009, month: 1, day: 1, 
        hours: 0, minutes: 0, seconds: 0 }, null);
    var BASE_DATE_UTC = cfg.timeutils.buildMsec({ year: 2009, month: 1, day: 1, 
        hours: 0, minutes: 0, seconds: 0 }, cfg.tz_offset_minutes);
    console.log("offset=" + cfg.tz_offset_minutes + " Device=" + BASE_DATE_DEVICE + " UTC=" + BASE_DATE_UTC);
    console.log(new Date(BASE_DATE_DEVICE));
    console.log(new Date(BASE_DATE_UTC));


    var getCmdName = function(idx) {
        for (var i in CMDS) {
            if (CMDS[i].value == idx) {
                return CMDS[i].name;
            }
        }
        return "UNKNOWN COMMAND!";
    };


    var getTrendName = function(idx) {
        for (var i in TRENDS) {
            if (TRENDS[i].value == idx) {
                return TRENDS[i].name;
            }
        }
        return "UNKNOWN TREND!";
    };

    var firmwareHeader = null;

    // builds a command in an ArrayBuffer
    // The first byte is always 0x01 (SYNC), 
    // the second and third bytes are a little-endian payload length.
    // then comes the payload, 
    // finally, it's followed with a 2-byte little-endian CRC of all the bytes
    // up to that point.
    // payload is any indexable array-like object that returns Numbers

    var buildPacket = function(command, payloadLength, payload) {
        var datalen = payloadLength + 6;
        var buf = new ArrayBuffer(datalen);
        var bytes = new Uint8Array(buf);
        var ctr = struct.pack(bytes, 0, "bsb", SYNC_BYTE,
            datalen, command);
        ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
        var crc = crcCalculator.calcDexcomCRC(bytes, ctr);
        struct.pack(bytes, ctr, "s", crc);
        return buf;
    };


    var readFirmwareHeader = function() {
        return {
            packet: buildPacket(
                CMDS.READ_FIRMWARE_HEADER.value, 0, null
            ),
            parser: function(packet) {
                var data = parseXMLPayload(packet);
                firmwareHeader = data;
                return data;
            }
        };
    };


    var readDataPageRange = function(rectype) {
        return {
            packet: buildPacket(
                CMDS.READ_DATA_PAGE_RANGE.value, 
                1,
                [rectype.value]
            ),
            parser: function(result) {
                return struct.unpack(result.payload, 0, "ii", ["lo", "hi"]);
                }
            };
    };


    var readEGVDataPages = function(rectype, startPage, numPages) {
        var parser = function(result) {
            var format = "iibbiiiibb";
            var header = struct.unpack(result.payload, 0, format, [
                    "index", "nrecs", "rectype", "revision", 
                    "pagenum", "r1", "r2", "r3", "j1", "j2"
                ]);
            return {
                header: header,
                data: parse_records(header, result.payload.subarray(struct.structlen(format)))
            };
        };

        var parse_records = function(header, data) {
            var all = [];
            var ctr = 0;
            for (var i = 0; i<header.nrecs; ++i) {
                var format = "iihbs";
                var flen = struct.structlen(format);
                var rec = struct.unpack(data, ctr, format, [
                    "systemSeconds", "displaySeconds", "glucose", "trend", "crc"   
                ]);
                // rec.glucose &= 0x3FF;
                if (rec.glucose < 0) {  // some glucose records have a negative value; these
                                        // invariably have a time identical to the next record,
                                        // so we presume that they are superceded by
                                        // the other record (probably a calibration)
                    continue;
                }
                rec.trend &= 0xF;
                rec.trendText = getTrendName(rec.trend);
                rec.systemTimeMsec = BASE_DATE_DEVICE + 1000*rec.systemSeconds;
                rec.displayTimeMsec = BASE_DATE_DEVICE + 1000*rec.displaySeconds;
                rec.displayTime = cfg.timeutils.mSecToISOString(rec.displayTimeMsec);
                rec.displayUtcMsec = BASE_DATE_UTC + 1000*rec.displaySeconds;
                rec.displayUtc = cfg.timeutils.mSecToISOString(rec.displayUtcMsec, cfg.tz_offset_minutes);
                rec.data = data.subarray(ctr, ctr + flen);
                ctr += flen;
                all.push(rec);
            }
            return all;
        };

        var format = "bib";
        var len = struct.structlen(format);
        var payload = new Uint8Array(len);
        struct.pack(payload, 0, format, rectype.value, startPage, numPages);

        return {
            packet: buildPacket(
                CMDS.READ_DATA_PAGES.value, len, payload
            ),
            parser: parser
        };
    };

    var readManufacturingDataPages = function(rectype, startPage, numPages) {
        var parser = function(result) {
            var format = "iibbi21.";
            var hlen = struct.structlen(format);
            var xlen = result.payload.length - hlen;
            var allformat = format + xlen + "z";
            var data = struct.unpack(result.payload, 0, allformat, [
                    "index", "nrecs", "rectype", "revision", 
                    "pagenum", "xml"
                ]);
            data.mfgdata = parseXML(data.xml);
            return data;
        };

        var format = "bib";
        var len = struct.structlen(format);
        var payload = new Uint8Array(len);
        struct.pack(payload, 0, format, rectype.value, startPage, numPages);

        return {
            packet: buildPacket(
                CMDS.READ_DATA_PAGES.value, len, payload
            ),
            parser: parser
        };
    };



    var readDataPageHeader = function() {
        return {
            packet: buildPacket(
                CMDS.READ_DATA_PAGE_HEADER.value, 0, null
            ),
            parser: null
        };
    };



    // accepts a stream of bytes and tries to find a dexcom packet
    // at the beginning of it.
    // returns a packet object; if valid == true it's a valid packet
    // if packet_len is nonzero, that much should be deleted from the stream
    // if valid is false and packet_len is nonzero, the previous packet 
    // should be NAKed.
    var extractPacket = function(bytes) {
        var packet = { 
            bytes: bytes,
            valid: false, 
            packet_len: 0,
            command: 0,
            payload: null, 
            crc: 0
        };

        if (bytes[0] != SYNC_BYTE) {
            return packet;
        }

        var plen = bytes.length;
        var packet_len = struct.extractShort(bytes, 1);
        // minimum packet len is 6
        if (packet_len > plen) {
            return packet;  // we're not done yet
        }

        // we now have enough length for a complete packet, so calc the CRC 
        packet.packet_len = packet_len;
        packet.crc = struct.extractShort(bytes, packet_len - 2);
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
    };


    // Takes an xml-formatted string and returns an object
    var parseXML = function(s) {
        console.log(s);
        var result = {tag:"", attrs:{}};
        var tagpat = /<([A-Za-z]+)/;
        var m = s.match(tagpat);
        if (m) {
            result.tag = m[1];
        }
        var gattrpat = /([A-Za-z]+)=["']([^"']+)["']/g;
        var attrpat = /([A-Za-z]+)=["']([^"']+)["']/;
        m = s.match(gattrpat);
        for (var r in m) {
            var attr = m[r].match(attrpat);
            if (result.attrs[attr[1]]) {
                console.log("Duplicated attribute!");
            }
            result.attrs[attr[1]] = attr[2];
        }
        return result;
    };


    var parseXMLPayload = function(packet) {
        if (!packet.valid) {
            return {};
        }
        if (packet.command !== 1) {
            return {};
        }

        var len = packet.packet_len - 6;
        var data = null;
        if (len) {
            data = parseXML(
                struct.extractString(packet.payload, 0, len));
        }
        return data;
    };

    // When you call this, it looks to see if a complete Dexcom packet has
    // arrived and it calls the callback with it and strips it from the buffer. 
    // It returns true if a packet was found, and false if not.
    var dexcomPacketHandler = function(buffer) {
        // for efficiency reasons, we're not going to bother to ask the driver
        // to decode things that can't possibly be a packet
        // first, discard bytes that can't start a packet
        var discardCount = 0;
        while (buffer.len() > 0 && buffer.get(0) != SYNC_BYTE) {
            ++discardCount;
        }
        if (discardCount) {
            buffer.discard(discardCount);
        }

        if (buffer.len() < 6) { // all complete packets must be at least this long
            return false;       // not enough there yet
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

    var listenForPacket = function (timeout, commandpacket, callback) {
        var abortTimer = setTimeout(function() {
            clearInterval(listenTimer);
            console.log("TIMEOUT");
            callback("TIMEOUT", null);
        }, timeout);

        var listenTimer = setInterval(function() {
            if (serialDevice.hasAvailablePacket()) {
                var pkt = serialDevice.nextPacket();
                // we always call the callback if we get a packet back,
                // so just cancel the timers if we do
                clearTimeout(abortTimer);
                clearInterval(listenTimer);
                if (pkt.command != CMDS.ACK.value) {
                    console.log("Bad result %d (%s) from data packet", 
                        pkt.command, getCmdName(pkt.command));
                    callback("Bad result " + pkt.command + " (" + 
                        getCmdName(pkt.command) + ") from data packet", pkt);
                } else {
                    // only attempt to parse the payload if it worked
                    if (pkt.payload) {
                        pkt.parsed_payload = commandpacket.parser(pkt);
                    }
                    callback(null, pkt);
                }
            }
        }, 20);     // spin on this one quickly
    };

    var dexcomCommandResponse = function(commandpacket, callback) {
        var p = new Uint8Array(commandpacket.packet);
        console.log(p);
        serialDevice.writeSerial(commandpacket.packet, function() {
            // once we've sent the command, start listening for a response
            // but if we don't get one in 1 second give up
            listenForPacket(1000, commandpacket, callback);
        });
    };

    var fetchOneEGVPage = function(pagenum, callback) {
        var cmd = readEGVDataPages(
            RECORD_TYPES.EGV_DATA, pagenum, 1);
        dexcomCommandResponse(cmd, function(err, page) {
            // console.log(page.parsed_payload);
            callback(err, page);
        });
    };

    var fetchManufacturingData = function(pagenum, callback) {
        var cmd = readDataPageRange(RECORD_TYPES.MANUFACTURING_DATA);
        // var cmd = readEGVDataPages(
        //     RECORD_TYPES.MANUFACTURING_DATA, pagenum, 1);
        dexcomCommandResponse(cmd, function(err, page) {
            console.log("mfr range");
            var range = page.parsed_payload;
            console.log(range);
            var cmd2 = readManufacturingDataPages(RECORD_TYPES.MANUFACTURING_DATA, 
                range.lo, range.hi-range.lo+1);
            dexcomCommandResponse(cmd2, function(err, result) {
                if (err) {
                    callback(err, result);
                } else {
                    callback(err, result.parsed_payload.mfgdata);
                }
            });
        });
    };

    var detectDexcom = function(obj, cb) {
        console.log("looking for dexcom");
        var cmd = readFirmwareHeader();
        dexcomCommandResponse(cmd, function(err, result) {
            if (err) {
                console.log("Failure trying to talk to dexcom.");
                console.log(err);
                console.log(result);
                cb(null, null);
            } else {
                cb(null, obj);
            }
        });
    };

    var downloadEGVPages = function(progress, callback) {
        var cmd = readDataPageRange(RECORD_TYPES.EGV_DATA);
        dexcomCommandResponse(cmd, function(err, pagerange) {
            if (err) {
                return callback(err, pagerange);
            }
            console.log("page range");
            var range = pagerange.parsed_payload;
            console.log(range);
            var pages = [];
            for (var pg = range.hi; pg >= range.lo; --pg) {
                pages.push(pg);
            }
            // pages = pages.slice(0, 3);      // FOR DEBUGGING!
            var npages = 0;
            var fetch_and_progress = function(data, callback) {
                progress(npages++ * 100.0/pages.length);
                return fetchOneEGVPage(data, callback);
            };
            async.mapSeries(pages, fetch_and_progress, function(err, results) {
                if (err) {
                    console.log("error in dexcomCommandResponse");
                    console.log(err);
                }
                console.log(results);
                callback(err, results);
            });

        });
    };

    var processEGVPages = function(pagedata) {
        var readings = [];
        for (var i=0; i<pagedata.length; ++i) {
            var page = pagedata[i].parsed_payload;
            for (var j=0; j<page.data.length; ++j) {
                var reading = _.pick(page.data[j], 
                    "displaySeconds", "displayTime", "displayUtc", "systemSeconds", 
                    "glucose", "trend", "trendText");
                reading.pagenum = page.header.pagenum;
                readings.push(reading);
            }
        }
        return readings;
    };

    var prepCBGData = function(progress, data) {
        cfg.jellyfish.setDeviceInfo( {
            deviceId: data.firmwareHeader.attrs.ProductName + " " + 
                data.manufacturing_data.attrs.SerialNumber,
            source: "device",
            timezoneOffset: cfg.tz_offset_minutes,
            units: "mg/dL"      // everything the Dexcom receiver stores is in this unit
        });
        var dataToPost = [];
        for (var i=0; i<data.cbg_data.length; ++i) {
            if (data.cbg_data[i].glucose < 39) {
                // special values are not posted for now
                continue;
            }
            var cbg = cfg.jellyfish.buildCBG(
                    data.cbg_data[i].glucose,
                    data.cbg_data[i].displayUtc,
                    data.cbg_data[i].displayTime
                );
            cbg.trend = data.cbg_data[i].trendText;
            dataToPost.push(cbg);
        }

        return dataToPost;
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
                console.log("Dexcom driver is disabled!");
                return cb(null, null);
            }
            cfg.deviceComms.setPacketHandler(dexcomPacketHandler);
            detectDexcom(obj, cb);
        },

        // this function starts the chain, so it has to create but not accept
        // the result (data) object; it's then passed down the rest of the chain
        setup: function (progress, cb) {
            progress(100);
            cb(null, { firmwareHeader: firmwareHeader });
        },

        connect: function (progress, data, cb) {
            progress(100);
            data.connect = true;
            cb(null, data);
        },

        getConfigInfo: function (progress, data, cb) {
            fetchManufacturingData(0, function(err, result) {
                data.manufacturing_data = result;
                progress(100);
                data.getConfigInfo = true;
                cb(null, data);
            });
        },

        fetchData: function (progress, data, cb) {
            progress(0);
            downloadEGVPages(progress, function (err, result) {
                data.egv_data = result;
                progress(100);
                cb(err, data);
            });
        },

        processData: function (progress, data, cb) {
            progress(0);
            data.cbg_data = processEGVPages(data.egv_data);
            data.post_records = prepCBGData(progress, data);
            var ids = {};
            for (var i=0; i<data.post_records.length; ++i) {
                var id = data.post_records[i].time + "|" + data.post_records[i].deviceId;
                if (ids[id]) {
                    console.log("duplicate! %s @ %d == %d", id, i, ids[id]-1);
                    console.log(data.post_records[ids[id]-1]);
                    console.log(data.post_records[i]);
                } else {
                    ids[id] = i+1;
                }
            }
            progress(100);
            data.processData = true;
            cb(null, data);
        },

        uploadData: function (progress, data, cb) {
            progress(0);
            cfg.jellyfish.post(data.post_records, progress, function(err, result) {
                if (err) {
                    console.log(err);
                    console.log(result);
                    progress(100);
                    return cb(err, data);
                } else {
                    progress(100);
                    return cb(null, data);
                }
            });
        },

        disconnect: function (progress, data, cb) {
            progress(100);
            data.disconnect = true;
            cb(null, data);
        },

        cleanup: function (progress, data, cb) {
            cfg.deviceComms.clearPacketHandler();
            progress(100);
            data.cleanup = true;
            cb(null, data);
        }
    };
};
