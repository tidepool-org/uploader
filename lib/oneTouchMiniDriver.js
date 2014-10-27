/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var _ = require('lodash');
var async = require('async');
var moment = require('moment-timezone');
var crcCalculator = require('./crc.js');
var struct = require('./struct.js')();

module.exports = function (config) {
  var cfg = _.clone(config);
  var serialDevice = config.deviceComms;

  var STX = 0x02;
  var ETX = 0x03;

  var LINK_CTRL_MASK = {
    MORE: 0x10,
    DISC: 0x08,
    ACK : 0x04,
    E   : 0x02,     // last bit of "expected" (receive) counter
    S   : 0x01,      // last bit of send counter
    NONE: 0x00
  };

  var send_bit = 0;
  var expected_receive_bit = 0;

  var buildLinkControlByte = function(lcb) {
    lcb |= send_bit;
    lcb |= expected_receive_bit;
    return lcb;
  };

  // builds a command in an ArrayBuffer
  // The first byte is always 0x01 (SYNC),
  // the second and third bytes are a little-endian payload length.
  // then comes the payload,
  // finally, it's followed with a 2-byte little-endian CRC of all the bytes
  // up to that point.
  // payload is any indexable array-like object that returns Numbers

  var buildPacket = function (linkctrl, payloadLength, payload) {
    var datalen = payloadLength + 6;
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var link = buildLinkControlByte(linkctrl);
    var ctr = struct.pack(bytes, 0, 'bbb', STX, datalen, link);
    if (payloadLength) {
      ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
    }
    bytes[ctr++] = ETX;
    var crc = crcCalculator.calcCRC_A(bytes, ctr);
    struct.pack(bytes, ctr, 's', crc);
    return buf;
  };

  var buildAckPacket = function() {
    return buildPacket(LINK_CTRL_MASK.NONE, 0);
  };

  var buildDisconnectPacket = function() {
    send_bit = 0;
    expected_receive_bit = 0;
    return buildPacket(LINK_CTRL_MASK.DISC, 0);
  };

  var buildReadSoftwareVersion = function() {
    var cmd = [0x05, 0x0D, 0x02];
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var buildReadSerialNumber = function() {
    var cmd = [0x05, 0x0B, 0x02, 0x00, 0x00, 0x00, 0x00, 0x84, 0x6A, 0xE8, 0x73, 0x00];
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var buildDeleteAllRecords = function() {
    var cmd = [0x05, 0x1A];
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var buildReadRecordNumber = function(recnum) {
    var cmd = [0x05, 0x1F, 0x00, 0x00];
    struct.pack(cmd, 2, 's', recnum);
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var buildGetRecordCount = function() {
    return buildReadRecordNumber(501);  // magic number that means 'tell me how many records you have'
  };

  var buildGetUnitSettings = function() {
    var cmd = [0x05, 0x09, 0x02, 0x09, 0x00, 0x00, 0x00, 0x00];
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var buildReadDateFormat = function() {
    var cmd = [0x05, 0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00];
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };

  var buildReadRTC = function() {
    var cmd = [0x05, 0x20, 0x02, 0x00, 0x00, 0x00, 0x00];
    return buildPacket(LINK_CTRL_MASK.NONE, cmd.length, cmd);
  };


  var BASE_DATE_DEVICE = moment.utc('1970-01-01').valueOf();
  var BASE_DATE_UTC = moment.tz('1970-01-01', cfg.timezone).valueOf();
  console.log('timezone=' + cfg.timezone + ' Device=' + BASE_DATE_DEVICE + ' UTC=' + BASE_DATE_UTC);
  console.log(new Date(BASE_DATE_DEVICE));
  console.log(new Date(BASE_DATE_UTC));


  // accepts a stream of bytes and tries to find a packet
  // at the beginning of it.
  // returns a packet object; if valid == true it's a valid packet
  // if packet_len is nonzero, that much should be deleted from the stream
  // if valid is false and packet_len is nonzero, the previous packet
  // should be NAKed.
  // don't call this if you don't have at least 2 bytes in store (and really
  // should be at least 6)
  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      lcb: 0,
      payload: null,
      crc: 0
    };

    if (bytes[0] != STX) {
      return packet;
    }

    var plen = bytes.length;
    var packet_len = struct.extractByte(bytes, 1);
    if (packet_len > plen) {
      return packet;  // we're not done yet
    }

    // we now have enough length for a complete packet, so calc the CRC
    packet.packet_len = packet_len;
    packet.crc = struct.extractShort(bytes, packet_len - 2);
    var crc = crcCalculator.calcCRC_A(bytes, packet_len - 2);
    if (crc != packet.crc) {
      // if the crc is bad, we should discard the whole packet
      // (packet_len is nonzero)
      return packet;
    }

    // link control is the third byte, packet is remainder of data up to ETX
    packet.lcb = bytes[2];
    packet.payload = new Uint8Array(packet_len - 6);
    for (var i = 0; i < packet_len - 6; ++i) {
      packet.payload[i] = bytes[i + 3];
    }

    packet.valid = true;
    return packet;
  };

  // When you call this, it looks to see if a complete OneTouch packet has
  // arrived and it calls the callback with it and strips it from the buffer.
  // It returns true if a packet was found, and false if not.
  var oneTouchPacketHandler = function (buffer) {
    // for efficiency reasons, we're not going to bother to ask the driver
    // to decode things that can't possibly be a packet
    // first, discard bytes that can't start a packet
    var discardCount = 0;
    while (buffer.len() > 0 && buffer.get(0) != STX) {
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

  // check if the E and S flags are correct, and update the counters.
  var checkFlags = function(lcb) {
    if ((lcb & LINK_CTRL_MASK.E) !== expected_receive_bit) {
      return false;
    }
    if ((lcb & LINK_CTRL_MASK.S) !== send_bit) {
      return false;
    }
    return true;
  };

  // an ack packet is invalid if the length is not 0, or if the ack bit isn't set, 
  // or if the E and S flags aren't correct.
  var isValidAcknowledgePacket = function(packet) {
    if (packet.packet_len !== 6) return false;
    if (packet.lcb & LINK_CTRL_MASK.ACK !== LINK_CTRL_MASK.ACK) return false;
    return checkFlags(packet.lcb);
  };

  var resetDevice = function() {
    return {
      packet: buildDisconnectPacket(),
      parser: function(packet) {
        if (packet.lcb & LINK_CTRL_MASK.DISC === 0) {
          console.log('Disconnect request did not respond with a disconnect.');
          return false;
        }
        return true;
      }
    };
  };

  var listenForPacket = function (timeout, parser, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      console.log('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      if (serialDevice.hasAvailablePacket()) {
        // FIX: call to extractPacket should be deleted!
        var pkt = serialDevice.nextPacket();
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        pkt.parsed_payload = parser(pkt);
        callback(null, pkt);
      }
    }, 20);     // spin on this one quickly
  };

  // this sends a command, then waits for an ack and a response packet, 
  // then calls the callback with the response packet
  var oneTouchCommandResponse = function (commandpacket, callback) {
    // this is a parser for the ack packet only
    var ackparser = function(packet) {
      if (!isValidAcknowledgePacket(packet)) {
        console.log('expected ACK failed to validate!');
        console.log(packet);
        return false;
      }
      return true;
    };

    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(1000, ackparser, function(got_ack) {
        // toggle the acknowledge bit
        send_bit ^= LINK_CTRL_MASK.S;
        // eventually should probably skip listening for second packet 
        // if the first didn't validate, but for now just go on
        listenForPacket(1000, commandpacket.parser, function(err, result) {
          // after parsing, ack the packet
          serialDevice.writeSerial(buildAckPacket(), function() {
            callback(err, result);
          });
          // and toggle the expected_receive bit
          expected_receive_bit ^= LINK_CTRL_MASK.E;
        });
      });
    });
  };

  // This resets the one-touch by sending a disconnect
  // We don't use the CommandResponse function because unlike everything
  // else, there's no second packet after the disconnect acknowledgement.
  var oneTouchDisconnect = function (callback) {
    // var p = new Uint8Array(commandpacket.packet);
    // console.log(p);
    var command = resetDevice();
    serialDevice.writeSerial(command.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(1000, command.parser, callback);
    });
  };

  var readSoftwareVersion = function() {
    return {
      packet: buildReadSoftwareVersion(),
      parser: function (result) {
        return struct.unpack(result.payload, 0, '...9Z8Z', ['version', 'creationDate']);
      }
    };
  };

  var readSerialNumber = function() {
    return {
      packet: buildReadSerialNumber(),
      parser: function (result) {
        // first 2 chars of payload are junk
        var sernum = String.fromCharCode.apply(null, result.payload.subarray(2));
        return { model: 'Mini', serialNumber: sernum };
      }
    };
  };

  var readRecordCount = function() {
    return {
      packet: buildGetRecordCount(),
      parser: function (result) {
        return struct.unpack(result.payload, 0, '..s', ['nrecs']);
      }
    };
  };



  var getDeviceInfo = function (obj, cb) {
    console.log('resetting oneTouch Mini');
    oneTouchDisconnect(function() {
      var cmd = readSoftwareVersion();
      oneTouchCommandResponse(cmd, function (err, result) {
        if (err) {
          console.log('Failure trying to talk to device.');
          console.log(err);
          console.log(result);
          cb(null, null);
        } else {
          _.assign(obj, result);
          cb(null, obj);
        }
      });
    });
  };

  var getSerialNumber = function (obj, cb) {
    var cmd = readSerialNumber();
    oneTouchCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to device.');
        console.log(err);
        console.log(result);
        cb(null, null);
      } else {
        _.assign(obj, result);
        cb(null, obj);
      }
    });
  };

  var getRecordCount = function (obj, cb) {
    var cmd = readRecordCount();
    oneTouchCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to device.');
        console.log(err);
        console.log(result);
        cb(null, null);
      } else {
        _.assign(obj, result);
        cb(null, obj);
      }
    });
  };


  return {
    detect: function (cb) {
      var cleanup = function(err, result) {
        cfg.deviceComms.disconnect(function() {
          cb(err, result);
        });
      };
      cfg.deviceComms.connect(oneTouchPacketHandler, function() {
        cfg.deviceComms.flush();
        getDeviceInfo({}, function(commsErr, obj) {
          if (commsErr) {
            cleanup(commsErr, obj);
          } else {
            getSerialNumber(obj, function (err, result) {
              if (result) {
                var parsed = result.parsed_payload;
                parsed.id = 'OneTouch ' + parsed.model + ' ' + parsed.serialNumber;
                console.log(parsed.id);
                cleanup(null, result);
              } else {
                cleanup('TIMEOUT', null);
              }
            });
          }
        });
      });
    },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (progress, cb) {
      progress(100);
      cb(null, {});
    },

    connect: function (progress, data, cb) {
      cfg.deviceComms.connect(oneTouchPacketHandler, function() {
        getDeviceInfo({}, function(commsErr, obj) {
          if (commsErr) {
            cb(commsErr, obj);
          } else {
            getSerialNumber(obj, function (err, result) {
              progress(100);
              data.connect = true;
              _.assign(data, obj);
              cb(null, data);
            });
          }
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      // we'll get the number of records here

      /*
      fetchManufacturingData(0, function (err, result) {
        data.manufacturing_data = result;
        progress(100);
        data.getConfigInfo = true;
        cb(null, data);
      });
*/
      progress(100);
      data.getConfigInfo = true;
      cb(null, data);

    },

    fetchData: function (progress, data, cb) {
      /*
      progress(0);
      downloadEGVPages(progress, function (err, result) {
        data.egv_data = result;
        progress(100);
        cb(err, data);
      });
*/
      progress(100);
      data.fetchData = true;
      cb(null, data);
    },

    processData: function (progress, data, cb) {
      /*
      progress(0);
      data.cbg_data = processEGVPages(data.egv_data);
      data.post_records = prepCBGData(progress, data);
      var ids = {};
      for (var i = 0; i < data.post_records.length; ++i) {
        var id = data.post_records[i].time + '|' + data.post_records[i].deviceId;
        if (ids[id]) {
          console.log('duplicate! %s @ %d == %d', id, i, ids[id] - 1);
          console.log(data.post_records[ids[id] - 1]);
          console.log(data.post_records[i]);
        } else {
          ids[id] = i + 1;
        }
      }
      */
      progress(100);
      data.processData = true;
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      /*
      progress(0);
      cfg.jellyfish.post(data.post_records, progress, function (err, result) {
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
*/
      progress(100);
      data.cleanup = true;
      cb(null, data);

    },

    disconnect: function (progress, data, cb) {
      progress(100);
      data.disconnect = true;
      cb(null, data);
    },

    cleanup: function (progress, data, cb) {
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.disconnect(function() {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    },

    testDriver: function(config) {
      var progress = function(v) {
        console.log('progress: ', v);
      };
      var data = {};
      this.connect(progress, data, function(err, result) {
        console.log('result:', result);
      });
    }
  };
};


  ////////////////////////////
  /*

  var readFirmwareHeader = function () {
    return {
      packet: buildPacket(
        CMDS.READ_FIRMWARE_HEADER.value, 0, null
      ),
      parser: function (packet) {
        var data = parseXMLPayload(packet);
        firmwareHeader = data;
        return data;
      }
    };
  };

  var ping = function () {
    return {
      packet: buildPacket(
        CMDS.PING.value, 0, null
      ),
      parser: function (packet) {
        console.log('pong!');
        console.log(packet);
      }
    };
  };

  var readDataPageRange = function (rectype) {
    return {
      packet: buildPacket(
        CMDS.READ_DATA_PAGE_RANGE.value,
        1,
        [rectype.value]
      ),
      parser: function (result) {
        return struct.unpack(result.payload, 0, 'ii', ['lo', 'hi']);
      }
    };
  };


  var readEGVDataPages = function (rectype, startPage, numPages) {
    var parser = function (result) {
      var format = 'iibbiiiibb';
      var header = struct.unpack(result.payload, 0, format, [
        'index', 'nrecs', 'rectype', 'revision',
        'pagenum', 'r1', 'r2', 'r3', 'j1', 'j2'
      ]);
      return {
        header: header,
        data: parse_records(header, result.payload.subarray(struct.structlen(format)))
      };
    };

    var parse_records = function (header, data) {
      var all = [];
      var ctr = 0;
      var format = 'iisbs';
      var flen = struct.structlen(format);

      for (var i = 0; i < header.nrecs; ++i) {
        var rec = struct.unpack(data, ctr, format, [
          'systemSeconds', 'displaySeconds', 'glucose', 'reserved', 'crc'
        ]);

        rec.reserved &= 0xF;
        rec.systemTimeMsec = BASE_DATE_DEVICE + 1000 * rec.systemSeconds;
        rec.displayTimeMsec = BASE_DATE_DEVICE + 1000 * rec.displaySeconds;
        rec.displayTime = cfg.timeutils.mSecToISOString(rec.displayTimeMsec);
        rec.displayUtcMsec = BASE_DATE_UTC + 1000 * rec.displaySeconds;
        rec.displayUtc = cfg.timeutils.mSecToISOString(rec.displayUtcMsec, cfg.timezone);
        rec.data = data.subarray(ctr, ctr + flen);
        ctr += flen;

        // dexcom specs say to ignore values outside these ranges
        // some glucose records have a value with the high bit set;
        // these seem to have a time identical to the next record,
        // so we presume that they are superceded by
        // the other record (probably a calibration)
        // we ignore these as instructed.
        if (rec.glucose >= 40 && rec.glucose <= 400) {
          all.push(rec);
        }
      }
      return all;
    };

    var format = 'bib';
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

  var readManufacturingDataPages = function (rectype, startPage, numPages) {
    var parser = function (result) {
      var format = 'iibbi21.';
      var hlen = struct.structlen(format);
      var xlen = result.payload.length - hlen;
      var allformat = format + xlen + 'z';
      var data = struct.unpack(result.payload, 0, allformat, [
        'index', 'nrecs', 'rectype', 'revision',
        'pagenum', 'xml'
      ]);
      data.mfgdata = parseXML(data.xml);
      return data;
    };

    var format = 'bib';
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


  var readDataPageHeader = function () {
    return {
      packet: buildPacket(
        CMDS.READ_DATA_PAGE_HEADER.value, 0, null
      ),
      parser: null
    };
  };


  
  // Takes an xml-formatted string and returns an object
  var parseXML = function (s) {
    console.log(s);
    var result = {tag: '', attrs: {}};
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
        console.log('Duplicated attribute!');
      }
      result.attrs[attr[1]] = attr[2];
    }
    return result;
  };


  var parseXMLPayload = function (packet) {
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
  var dexcomPacketHandler = function (buffer) {
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

  var dexcomCommandResponse = function (commandpacket, callback) {
    // var p = new Uint8Array(commandpacket.packet);
    // console.log(p);
    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(1000, commandpacket, callback);
    });
  };

  var fetchOneEGVPage = function (pagenum, callback) {
    var cmd = readEGVDataPages(
      RECORD_TYPES.EGV_DATA, pagenum, 1);
    dexcomCommandResponse(cmd, function (err, page) {
      // console.log(page.parsed_payload);
      callback(err, page);
    });
  };

  var fetchManufacturingData = function (pagenum, callback) {
    var cmd = readDataPageRange(RECORD_TYPES.MANUFACTURING_DATA);
    // var cmd = readEGVDataPages(
    //     RECORD_TYPES.MANUFACTURING_DATA, pagenum, 1);
    dexcomCommandResponse(cmd, function (err, page) {
      console.log('mfr range');
      var range = page.parsed_payload;
      console.log(range);
      var cmd2 = readManufacturingDataPages(RECORD_TYPES.MANUFACTURING_DATA,
                                            range.lo, range.hi - range.lo + 1);
      dexcomCommandResponse(cmd2, function (err, result) {
        if (err) {
          callback(err, result);
        } else {
          callback(err, result.parsed_payload.mfgdata);
        }
      });
    });
  };

  var getFirmwareHeader = function (obj, cb) {
    console.log('looking for dexcom');
    var cmd = readFirmwareHeader();
    dexcomCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to dexcom.');
        console.log(err);
        console.log(result);
        cb(null, null);
      } else {
        cb(null, obj);
      }
    });
  };

  var downloadEGVPages = function (progress, callback) {
    var cmd = readDataPageRange(RECORD_TYPES.EGV_DATA);
    dexcomCommandResponse(cmd, function (err, pagerange) {
      if (err) {
        return callback(err, pagerange);
      }
      console.log('page range');
      var range = pagerange.parsed_payload;
      console.log(range);
      var pages = [];
      for (var pg = range.hi; pg >= range.lo; --pg) {
        pages.push(pg);
      }
      // pages = pages.slice(0, 3);      // FOR DEBUGGING!
      var npages = 0;
      var fetch_and_progress = function (data, callback) {
        progress(npages++ * 100.0 / pages.length);
        return fetchOneEGVPage(data, callback);
      };
      async.mapSeries(pages, fetch_and_progress, function (err, results) {
        if (err) {
          console.log('error in dexcomCommandResponse');
          console.log(err);
        }
        console.log(results);
        callback(err, results);
      });

    });
  };

  var processEGVPages = function (pagedata) {
    var readings = [];
    for (var i = 0; i < pagedata.length; ++i) {
      var page = pagedata[i].parsed_payload;
      for (var j = 0; j < page.data.length; ++j) {
        var reading = _.pick(page.data[j],
                             'displaySeconds', 'displayTime', 'displayUtc', 'systemSeconds',
                             'glucose', 'trend', 'trendText');
        reading.pagenum = page.header.pagenum;
        readings.push(reading);
      }
    }
    return readings;
  };

  var prepCBGData = function (progress, data) {
    cfg.builder.setDefaults({
                              deviceId: data.firmwareHeader.attrs.ProductName + ' ' +
                                        data.manufacturing_data.attrs.SerialNumber,
                              source: 'device',
                              units: 'mg/dL'      // everything the Dexcom receiver stores is in this unit
                            });
    var dataToPost = [];
    for (var i = 0; i < data.cbg_data.length; ++i) {
      var datum = data.cbg_data[i];
      if ((data.cbg_data[i].glucose < 40) || (data.cbg_data[i].glucose > 400)) {
        // special and out-of-range values are not posted for now
        continue;
      }
      var cbg = cfg.builder.makeCBG()
        .with_value(datum.glucose)
        .with_time(datum.displayUtc)
        .with_deviceTime(datum.displayTime)
        .with_timezoneOffset(cfg.timeutils.computeTimezoneOffset(datum.displayTime, datum.displayUtc))
        .set('trend', datum.trendText)
        .done();
      dataToPost.push(cbg);
    }

    return dataToPost;
  };

  function do_ping(cb) {
    var cmd = ping();
    dexcomCommandResponse(cmd, function (err, result) {
      if (err) {
        console.log('Failure trying to talk to dexcom.');
        console.log(err);
        console.log(result);
        cb(null, null);
      } else {
        cb(null, null);
      }
    });
  }
*/

