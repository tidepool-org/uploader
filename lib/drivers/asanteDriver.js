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
var sundial = require('sundial');
var util = require('util');
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();

var pumpConstants = {
  69: require('../asante/asante_data/asante_pump_version_69.js'),
  72: require('../asante/asante_data/asante_pump_version_72.js')
};
var pumpVersion = 0;

var asanteSimulatorMaker = require('../asante/asanteSimulator');

var isChromeApp = typeof chrome !== 'undefined';
var debug = isChromeApp ? require('../bows')('AsanteDriver') : console.log;

module.exports = function (config) {
  var cfg = config;

  // these are assumptions we are making about the data; if this changes
  // in a future pump then the parser will need to get more sophisticated
  var N_BASAL_PROFILES = 4;
  var N_SEGMENTS_PER_PROFILE = 10;
  var N_FOOD_PROFILES = 8;
  var N_BG_PROFILES = 3;
  var N_TARGET_BGS = 3;

  var SYNC_BYTE = 0x7E;

  var BAUDRATES = {
    BAUD_9600: { value: 1, name: '9600'},
    BAUD_19200: { value: 2, name: '19200'},
    BAUD_28800: { value: 3, name: '28800'},
    BAUD_38400: { value: 4, name: '38400'},
    BAUD_48000: { value: 5, name: '48000'},
    BAUD_57600: { value: 6, name: '57600'},
    BAUD_96000: { value: 10, name: '96000'},
    BAUD_115200: { value: 12, name: '115200'}
  };

  var REPLY = {
    NAK: { value: 0, name: 'ACK'},
    ACK: { value: 1, name: 'NAK'},
    STOP: { value: 2, name: 'STOP'}
  };

  var DESCRIPTORS = {
    DEVICE_RESPONSE: { value: 0x01, name: 'DeviceResponse'},
    DISCONNECT_ACK: { value: 0x04, name: 'DisconnectAcknowledge'},
    BEACON: { value: 0x05, name: 'Beacon'},
    NAK: { value: 0x06, name: 'NAK'},
    BAUD_RATE_ACK: { value: 0x07, name: 'BaudRateChanged'},
    RESPONSE_RECORD: { value: 0x08, name: 'ResponseRecord'},
    EOF: { value: 0x09, name: 'EOF'},
    QUERY_DEVICE: { value: 0x10, name: 'QueryDevice'},
    DISCONNECT: { value: 0x40, name: 'Disconnect'},
    SET_BAUD: { value: 0x70, name: 'SetBaud'},
    REQUEST_RECORD: { value: 0x80, name: 'RequestRecord'},
    LOW_BATTERY_BEACON: { value: 0x85, name: 'Low Battery Beacon'},
    REQUEST_NEXT: { value: 0x90, name: 'RequestNext'}
  };

  var PK = null;
  function setupUsefulConstants(version) {
    debug('Pump version is', version);
    if (!pumpConstants[version]) {
      debug('Unknown pump version!');
      return false;
    }
    pumpVersion = version;
    PK = pumpConstants[version];
    PK.DATA_RECORDS = PK.recordTypes;
    PK.EVENT_TYPES = PK.userlist.bc_EvtType;
    PK.COMPLETION_CODES = PK.userlist.cc_CompletionCode;
    PK.BOLUS_TYPES = PK.userlist.bt_BolusTypes;
    return true;
  }

  var cvtClicksToUnits = function (clicks) {
    return clicks / 20.0;
  };

  var cvtBg = function (asanteReading) {
    return asanteReading / 10.0;
  };

  // TODO: not yet sure if this is correct -- need to confirm
  var cvtSensitivity = function (asanteReading) {
    return asanteReading / 10.0;
  };

  var cvtCarbRatio = function (asanteReading) {
    return asanteReading / 10.0;
  };

  var cvtIntegerInsulin = function (asanteReading) {
    return asanteReading / 100.0;
  };

  var cvtMinToMsec = function (minutes) {
    return minutes * sundial.MIN_TO_MSEC;
  };

  var cvtSecToMsec = function (seconds) {
    return seconds * sundial.SEC_TO_MSEC;
  };

  var cvtHrsToMsec = function (hours) {
    return hours * 60 * sundial.MIN_TO_MSEC;
  };

  var _getName = function (list, idx) {
    for (var i in list) {
      if (list[i].value == idx) {
        return list[i].name;
      }
    }
    return 'UNKNOWN!';
  };

  var getDescriptorName = function (idx) {
    return _getName(DESCRIPTORS, idx);
  };

  var getReplyName = function (idx) {
    return _getName(REPLY, idx);
  };

  var getDataRecordName = function (idx) {
    return _getName(PK.DATA_RECORDS, idx);
  };

  var _timeState = {
    timeRecords: []
  };

  var _asanteBaseTime = new Date(2008, 0, 1, 0, 0, 0).valueOf();

  var cvtRTCTime = function (t) {
    if (_timeState.timeRecords.length > 1) {
      debug('WARNING -- there are more than 1 time records - timestamps may be wrong.');
    }
    if (_timeState.timeRecords[0]) {
      var time = t +
                 _timeState.timeRecords[0].UserSetTime -
                 _timeState.timeRecords[0].RtcAtSetTime;
      return time;
    }
    return t;
  };

  var humanReadableTime = function (t) {
    var time = _asanteBaseTime + t * sundial.SEC_TO_MSEC;
    return new Date(time).toUTCString();
  };

  var getDeviceTime = function (t) {
    var atime = _asanteBaseTime + t * sundial.SEC_TO_MSEC;
    var time = cvtRTCTime(atime);
    var dt = new Date(time);
    return sundial.formatDeviceTime(dt);
  };

  var getUTCTime = function (t) {
    var atime = _asanteBaseTime + t * sundial.SEC_TO_MSEC;
    var time = cvtRTCTime(atime);
    var dt = new Date(time);
    var utc = sundial.applyTimezone(dt, cfg.timezone).toISOString();
    return utc;
  };

  var buildTimeItems = function(rec) {
    rec.deviceTime = getDeviceTime(rec.DateTime);
    rec.UTCTime = getUTCTime(rec.DateTime);
    rec.timezoneOffset = sundial.getOffsetFromZone(rec.UTCTime, cfg.timezone);
  };

  var convertSubobjects = function(rec) {
    var removeKeys = [];

    // first, if there's a '.', make it a subobject
    _.forEach(rec, function(item, key) {
      var ix = (key+'').indexOf('.');
      if (ix !== -1) {
        // we have a subobject, let's split it
        var name = key.slice(0, ix);
        var tail = key.slice(ix + 1);
        var child = {};
        child[tail] = item;
        removeKeys.push(key);
        if (rec[name]) {
          rec[name] = _.assign(rec[name], child);
        } else {
          rec[name] = child;
        }
      }
    });

    // now eliminate the stuff we pushed down in the tree
    var rec2 = _.omit(rec, removeKeys);
    removeKeys = [];

    // now look for array indices
    var indexpat = /(.+)\[(\d)+\]/;
    _.forEach(rec2, function(item, key) {
      var m = indexpat.exec(key);
      if (m) {
        removeKeys.push(key);
        var name = m[1];
        if (!rec2[name]) {
          // we don't already have it, create the array
          rec2[name] = [];
        }
        rec2[name][m[2]] = item;
      }
    });

    // and remove the stuff we just put in arrays
    var rec3 = _.omit(rec2, removeKeys);

    // finally, recurse over the new child elements
    _.forEach(rec3, function(item, key) {
      if (_.isObject(item)) {
        rec3[key] = convertSubobjects(item);
      }
    });
    return rec3;
  };


  // builds a command in an ArrayBuffer
  // The first byte is always 7e (SYNC),
  // the second byte is the command descriptor,
  // the third and fourth bytes are a little-endian payload length.
  // then comes the payload,
  // finally, it's followed with a 2-byte little-endian CRC of all the bytes
  // up to that point.
  // payload is any indexable array-like object that returns Numbers

  var buildPacket = function (descriptor, payloadLength, payload) {
    var buf = new ArrayBuffer(payloadLength + 6);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'bbs', SYNC_BYTE,
                          descriptor, payloadLength);
    ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
    var crc = crcCalculator.calcCRC_A(bytes, ctr);
    struct.pack(bytes, ctr, 's', crc);
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
      console.log('Bad baud rate specified: %d - using 9600', rate);
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

  var queryDevice = function () {
    return {
      packet: queryDevice_pkt(),
      parser: parsePacket
    };
  };

  var requestRecord = function (rectype, oldest_first) {
    return {
      packet: requestRecord_pkt(rectype, oldest_first),
      parser: parsePacket
    };
  };

  var nextRecord = function () {
    return {
      packet: ack_pkt(),
      parser: parsePacket
    };
  };

  var resendRecord = function () {
    return {
      packet: nak_pkt(),
      parser: parsePacket
    };
  };

  var stopSending = function () {
    return {
      packet: stop_pkt(),
      parser: parsePacket
    };
  };

  var setBaudRate = function (rate) {
    return {
      packet: setBaudRate_pkt(rate),
      parser: parsePacket
    };
  };

  var cmd_disconnect = function () {
    return {
      packet: disconnect_pkt(),
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
  var extractPacket = function (bytes) {
    var packet = {
      valid: false,
      sync: 0,
      descriptor: 0,
      payload_len: 0,
      payload: null,
      crc: 0,
      packet_len: 0
    };

    var plen = bytes.length; // this is how many bytes we've been handed
    if (plen < 6) {          // if we don't have at least 6 bytes, don't bother
      return packet;
    }

    // we know we have at least enough to check the packet header, so do that
    struct.unpack(bytes, 0, 'bbs', ['sync', 'descriptor', 'payload_len'], packet);

    // if the first byte isn't our sync byte, then just discard that
    // one byte and let our caller try again.
    if (packet.sync != SYNC_BYTE) {
      packet.packet_len = 1;
      return packet;
    }

    var need_len = packet.payload_len + 6;
    if (need_len > plen) {
      return packet; // we don't have enough yet so go back for more
    }
    packet.packet_len = need_len;

    // we now have enough length for a complete packet, so calc the CRC
    packet.crc = struct.extractShort(bytes, packet.packet_len - 2);
    var crc = crcCalculator.calcCRC_A(bytes, packet.packet_len - 2);
    if (crc != packet.crc) {
      // if the crc is bad, we should discard the whole packet
      // (packet_len is nonzero)
      console.log('Bad CRC!');
      return packet;
    }

    if (packet.payload_len) {
      packet.payload = new Uint8Array(packet.payload_len);
      for (var i = 0; i < packet.payload_len; ++i) {
        packet.payload[i] = bytes[i + 4];
      }
    }

    packet.valid = true;
    return packet;
  };

  var parsePacket = function (packet) {
    if (packet.valid) {
      switch (packet.descriptor) {
        case DESCRIPTORS.DEVICE_RESPONSE.value:
          packet.pumpinfo = {
            model: struct.extractString(packet.payload, 0, 4),
            serialNumber: struct.extractString(packet.payload, 5, 11),
            // asante docs say that pumpRecordVersion is a 2-character
            // ascii string, and the example in the documentation says '60',
            // but the pump I have returns the two characters 0x00 and 0x45,
            // which you would expect would be either the decimal value 17664,
            // a null and the letter E,
            // or a bug in either the documentation or this version of the pump.
            // Turns out that it's supposed to be decimal 69, so I'm going to
            // treat it as a byte rather than a word.
            pumpRecordVersion: struct.extractByte(packet.payload, 18)
          };
          break;
        case DESCRIPTORS.DISCONNECT_ACK.value:
          packet.disconnected = true;
          break;
        case DESCRIPTORS.BEACON.value:
          packet.beacon = true;
          packet.lastbeacon = Date.now();
          break;
        case DESCRIPTORS.LOW_BATTERY_BEACON.value:
          packet.beacon = true;
          packet.lastbeacon = Date.now();
          packet.battery_low = true;
          break;
        case DESCRIPTORS.NAK.value:
          packet.NAK = true;
          packet.errorcode = packet.payload[0];
          packet.errormessage = [
            'No sync byte',
            'CRC mismatch',
            'Illegal baud rate',
            'Data query not linked to same record query.',
            'Record number out of range',
            'Order field out of range',
            'Host ack code out of range',
            'Message descriptor out of range'
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

  var unpackDataRecord = function (rec) {
    switch (rec.rectype) {
      case PK.DATA_RECORDS.LOG_BOLUS.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_BOLUS.struct,
          PK.DATA_RECORDS.LOG_BOLUS.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_SMART.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_SMART.struct,
          PK.DATA_RECORDS.LOG_SMART.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_BASAL.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_BASAL.struct,
          PK.DATA_RECORDS.LOG_BASAL.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_BASAL_CONFIG.value:
        var hdr = 's2ib.';
        var sz = struct.structlen(hdr);
        struct.unpack(rec.data, 0, hdr, [
          'crc',
          'DateTime',
          'SeqNmbr',
          'EventType'
        ], rec);
        buildTimeItems(rec);
        switch (rec.EventType) {
          case PK.EVENT_TYPES.bc_0_ProfileEvent.value:
            struct.unpack(rec.data, sz, '2sb8zb', [
              'ActiveProfile',
              'Total24Hour',
              'ProfileEvent',
              'Name',
              'ProfileNumber'
            ], rec);
            break;
          case PK.EVENT_TYPES.bc_1_TempBasal.value:
            struct.unpack(rec.data, sz, '3sb', [
              'Percentage',
              'DurationProgrammed_minutes',
              'DurationFinal',
              'CompletionCode'
            ], rec);
            rec.data.Completion_text = _getName(PK.COMPLETION_CODES,
                                                rec.data.CompletionCode);
            break;
          case PK.EVENT_TYPES.bc_2_PumpStopped.value:
            struct.unpack(rec.data, sz, 'ib', [
              'RestartTime',
              'Cause'
            ], rec);
            break;
          default:
            console.log('Unknown event type!');
            console.log(rec);
            break;
        }
        break;
      case PK.DATA_RECORDS.LOG_ALARM_ALERT.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_ALARM_ALERT.struct,
          PK.DATA_RECORDS.LOG_ALARM_ALERT.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_PRIME.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_PRIME.struct,
          PK.DATA_RECORDS.LOG_PRIME.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_PUMP.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_PUMP.struct,
          PK.DATA_RECORDS.LOG_PUMP.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_MISSED_BASAL.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_MISSED_BASAL.struct,
          PK.DATA_RECORDS.LOG_MISSED_BASAL.fields,
          rec);
        break;
      case PK.DATA_RECORDS.LOG_TIME_EDITS.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.LOG_TIME_EDITS.struct,
          PK.DATA_RECORDS.LOG_TIME_EDITS.fields,
          rec);
        break;
      case PK.DATA_RECORDS.TIME_MANAGER_DATA.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.TIME_MANAGER_DATA.struct,
          PK.DATA_RECORDS.TIME_MANAGER_DATA.fields,
          rec);
        rec.hrRTC = humanReadableTime(rec.RtcAtSetTime);
        rec.hrUserTime = humanReadableTime(rec.UserSetTime);
        debug('RTC', rec.hrRTC);
        debug('UserTime', rec.hrUserTime);
        _timeState.timeRecords.push({
                                      RtcAtSetTime: rec.RtcAtSetTime,
                                      UserSetTime: rec.UserSetTime,
                                      userTimeFlag: rec.userTimeFlag
                                    });
        break;
      case PK.DATA_RECORDS.USER_SETTINGS.value:
        struct.unpack(rec.data, 0,
          PK.DATA_RECORDS.USER_SETTINGS.struct,
          PK.DATA_RECORDS.USER_SETTINGS.fields,
          rec);
        convertSubobjects(rec);
        break;
    }
  };

  var asantePacketHandler = function (buffer) {
    // first, discard bytes that can't start a packet
    var discardCount = 0;
    while (buffer.len() > discardCount && buffer.get(0) != SYNC_BYTE) {
      ++discardCount;
    }
    if (discardCount) {
      buffer.discard(discardCount);
    }

    if (buffer.len() < 6) { // all complete packets must be at least this long
      return null;          // not enough there yet
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

  var packetCount = 0;

  var listenForPacket = function (timeout, ignoreBeacons, parser, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('abortTimer TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      while (cfg.deviceComms.hasAvailablePacket()) {
        var pkt = cfg.deviceComms.nextPacket();
        // if we sent a command, ignore all beacons (they may have been
        // left in the buffer before we started).
        if (pkt.valid && (!ignoreBeacons ||
                          pkt.descriptor !== DESCRIPTORS.BEACON.value)) {
          clearTimeout(abortTimer);
          clearInterval(listenTimer);
          parser(pkt);
          return callback(null, pkt);
        }
      }
    }, 20); // spin on this one quickly
  };

  var asanteCommandResponse = function (commandpacket, callback) {
    cfg.deviceComms.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(1000, true, commandpacket.parser, callback);
    });
  };

  var listenForBeacon = function (callback) {
    listenForPacket(7000, false, parsePacket, function(err, packet) {
      if (packet && packet.battery_low) {
        callback('LOW BATTERY', packet);
      } else {
        callback(err, packet);
      }
    });
  };

  var nak_count = 0;

  // callback is called when EOF happens with all records retrieved
  var asanteDownloadRecords = function (recordtype, callback) {
    var cmd = requestRecord(recordtype, false);
    var retval = [];
    debug('Requesting recordtypes ' + getDataRecordName(recordtype));
    function iterate(err, result) {
      cfg.deviceComms.emitLog(true);
      if (err) {
        if (err == 'TIMEOUT' && nak_count < 10) {
          debug('NAK #', ++nak_count);
          var resend = resendRecord();
          return asanteCommandResponse(resend, iterate);
        }
        debug('Error in iterate!');
        callback(err, result);
      } else if (result.valid) {
        if (result.descriptor == DESCRIPTORS.RESPONSE_RECORD.value) {
          // process record
          retval.push(result.datarecord);
          // request next record
          var next = nextRecord();
          if (retval.length >= 3000) { // 3000 is bigger than any log's capacity
            next = stopSending();
            // uncomment this debug statment when you change the limit
            // to be < 3000 (i.e., 30 or so) for quick debugging
            // debug('Cutting it short for debugging!');
          }
          setTimeout(function () {
            asanteCommandResponse(next, iterate);
          }, 10);
        } else if (result.descriptor == DESCRIPTORS.EOF.value) {
          debug('Got EOF!');
          callback(null, retval);
        } else {
          debug('BAD RESULT');
          debug(result);
          callback(result, null);
        }
      } else {
        debug('RESULT NOT VALID (2)');
        callback(result, null);
      }
    }

    asanteCommandResponse(cmd, iterate);
  };

  var asanteGetHeader = function (depth, callback) {
    var cmd = queryDevice();
    debug('Requesting header');
    function iterate(err, result) {
      if (err) {
        if (err === 'TIMEOUT' && depth < 5) {
          debug('Recursing!');
          asanteGetHeader(depth+1, callback);
          return;
        } else {
          callback(err, result);
        }
      } else if (result.valid) {
        if (result.descriptor === DESCRIPTORS.DEVICE_RESPONSE.value) {
          debug('Asante header');
          var deviceInfo = result.pumpinfo;
          debug(result);
          callback(null, deviceInfo);
        } else {
          debug('BAD RESULT');
          debug(result);
          callback(result, null);
        }
      } else {
        debug('RESULT NOT VALID');
        callback(result, null);
      }
    }

    asanteCommandResponse(cmd, iterate);
  };

  var asanteFetch = function (progress, callback) {
    var getRecords = function (rectype, progressLevel) {
      return function (callback) {
        asanteDownloadRecords(rectype, function (err, result) {
          progress(progressLevel);
          callback(err, result);
        });
      };
    };

    async.series([
                  getRecords(PK.DATA_RECORDS.TIME_MANAGER_DATA.value, 10),
                  getRecords(PK.DATA_RECORDS.LOG_BASAL_CONFIG.value, 20),
                  getRecords(PK.DATA_RECORDS.LOG_BOLUS.value, 40),
                  getRecords(PK.DATA_RECORDS.LOG_SMART.value, 60),
                  getRecords(PK.DATA_RECORDS.LOG_BASAL.value, 80),
                  getRecords(PK.DATA_RECORDS.USER_SETTINGS.value, 95)
                 ],
                 function (err, result) {
                   debug('asanteFetch');
                   if (err) {
                     debug(err);
                     callback(err, result);
                   } else {
                      var settings = convertSubobjects(result[5][0]);
                      var retval = {
                       timeManager: result[0],
                       basalConfig: result[1],
                       bolusRecords: result[2],
                       smartRecords: result[3],
                       basalRecords: result[4],
                       settings: settings
                     };
                     debug(retval);
                     callback(null, retval);
                   }
                 });

  };

  var asanteSetBaudRate = function (newrate, cb) {
    asanteCommandResponse(setBaudRate(newrate), function (err, result) {
      if (err) {
        debug('Error setting baud rate.');
        cb(err, result);
      } else {
        debug(util.format('Pump data rate set to #%s', result.newBaudrate));
        var bitrate = parseInt(_getName(BAUDRATES, result.newBaudrate), 10);
        debug('New data rate = ' + bitrate);
        cfg.deviceComms.changeBitRate(bitrate, function(changed) {
          if (!changed) {
            err = 'BitRate Change Failed!';
          }
          cb(err, result);
        });
      }
    });
  };

  var asanteDisconnect = function (callback) {
    asanteSetBaudRate(9600, callback);
    // asanteCommandResponse(cmd_disconnect(), function(err, result) {
    //     if (err) {
    //         console.log('Error disconnecting.');
    //     } else {
    //         console.log('Disconnected.');
    //     }
    //     callback(err, result);
    // });
  };

  var asantePostprocess = function (data) {
    // decorate the settings with converted information
    function makeArray(obj) {
      obj = _.toArray(obj);
    }

    function fixArrayValues(arr, conversions) {
      _.each(arr, function(o) {
        _.each(conversions, function(conv) {
          o[conv.to] = conv.func(o[conv.from]);
        });
      });
    }

    function fixValues(o, conversions) {
      _.each(conversions, function(conv) {
        // this copies the structure we need
        makeArray(o[conv.to]);
        o[conv.to] = _.clone(o[conv.from]);
        _.each(o[conv.from], function(item, index) {
          o[conv.to][index] = conv.func(item);
        });
      });
    }

    var s = data.settings;
    fixValues(s.BGProfile, [
      { from: 'BGRatio', to: 'insulinSensitivity', func: cvtSensitivity },
      { from: 'StartTime', to: 'startTime_msec', func: cvtMinToMsec }
    ]);
    fixValues(s.FoodProfile, [
      { from: 'CarbRatio', to: 'carbRatio_gramsperunit', func: cvtCarbRatio },
      { from: 'StartTime', to: 'startTime_msec', func: cvtMinToMsec }
    ]);
    fixValues(s.TargetBG, [
      { from: 'MaxBG', to: 'MaxBG_mgdl', func: cvtBg },
      { from: 'MinBG', to: 'MinBG_mgdl', func: cvtBg },
      { from: 'StartTime', to: 'startTime_msec', func: cvtMinToMsec }
    ]);

    fixValues(s.BasalProfile, [
      { from: 'Total24Hour', to: 'Total24Hour_units', func: cvtClicksToUnits }
    ]);

    for (var i=0; i<N_BASAL_PROFILES; ++i) {
      var item = s.BasalProfile[i];
      makeArray(item.Segment);
      for (var j=0; j<N_SEGMENTS_PER_PROFILE; ++j) {
        var seg = item.Segment[j];
        seg.Amount_units = cvtIntegerInsulin(seg.Amount);
        seg.startTime_msec = cvtMinToMsec(seg.StartTime);
      }
    }
    s.TargetBGMax_mgdl = cvtBg(s.TargetBGMax);
    s.TargetBGMin_mgdl = cvtBg(s.TargetBGMin);

    // basal records need a cleanup too
    fixArrayValues(data.basalRecords, [
      { from: 'ClicksDelivered', to: 'Delivered_units', func: cvtClicksToUnits },
      { from: 'DateTime', to: 'UTCTime', func: getUTCTime },
      { from: 'DateTime', to: 'deviceTime', func: getDeviceTime }
    ]);
  };

  // note -- this puts a bolus record hash into data
  var asanteBuildBolusRecords = function (data, records) {
    var postrecords = [];
    data.bolusIndexHash = {};
    for (var i = 0; i < data.bolusRecords.length; ++i) {
      var b = data.bolusRecords[i];
      b.unitsDelivered = cvtClicksToUnits(b.ClicksDelivered);
      buildTimeItems(b);
      b.duration_msec = b.duration15MinUnits * 15 * sundial.MIN_TO_MSEC;

      var rec;
      if (b.Type === PK.BOLUS_TYPES.bt_Now.value) {
        b.textType = PK.BOLUS_TYPES.bt_Now.name;
        rec = cfg.builder.makeNormalBolus()
          .with_normal(b.unitsDelivered)
          .with_time(b.UTCTime)
          .with_deviceTime(b.deviceTime)
          .with_timezoneOffset(b.timezoneOffset)
          .done();
      } else if (b.Type === PK.BOLUS_TYPES.bt_Timed.value) {
        b.textType = PK.BOLUS_TYPES.bt_Timed.name;
        rec = cfg.builder.makeSquareBolus()
          .with_extended(b.unitsDelivered)
          .with_duration(b.duration_msec)
          .with_time(b.UTCTime)
          .with_deviceTime(b.deviceTime)
          .with_timezoneOffset(b.timezoneOffset)
          .done();
      } else if (b.Type === PK.BOLUS_TYPES.bt_Combo.value) {
        b.textType = PK.BOLUS_TYPES.bt_Combo.name;
        // this is to calculate the split for extended boluses in case it didn't all
        // get delivered
        var normalRequested = cvtClicksToUnits(b.NowClicksRequested);
        // var extendedRequested = cvtClicksToUnits(b.TimedClicksRequested);
        b.normalUnits = Math.min(b.unitsDelivered, normalRequested);
        b.extendedUnits = b.unitsDelivered - b.normalUnits;
        rec = cfg.builder.makeDualBolus()
          .with_normal(b.normalUnits)
          .with_extended(b.extendedUnits)
          .with_duration(b.duration_msec)
          .with_time(b.UTCTime)
          .with_deviceTime(b.deviceTime)
          .with_timezoneOffset(b.timezoneOffset)
          .done();
      }
      data.bolusIndexHash[b.BolusID] = rec;
      postrecords.push(rec);
    }
    return records.concat(postrecords);
  };

  var asanteBuildWizardRecords = function (data, records) {
    var postrecords = [];
    for (var i = 0; i < data.smartRecords.length; ++i) {
      var wz = data.smartRecords[i];
      wz.totalCalculated_units = cvtIntegerInsulin(wz.TotalInsulin);
      wz.recommended_carb_units = cvtIntegerInsulin(wz.NetCarbInsulin);
      wz.recommended_correction_units = cvtIntegerInsulin(wz.NetBGInsulin);
      wz.IOB_units = cvtIntegerInsulin(wz.IOB);
      wz.bg = cvtBg(wz.CurrentBG);
      buildTimeItems(wz);
      wz.carbInput = wz.FoodCarbs;
      var refBolus = data.bolusIndexHash[wz.BolusID] || null;

      if (wz.bg > 0) {
        var bgRec = cfg.builder.makeSMBG()
          .with_value(wz.bg)
          .with_time(wz.UTCTime)
          .with_deviceTime(wz.deviceTime)
          .with_timezoneOffset(wz.timezoneOffset)
          .with_subType('manual')
          // TODO: don't hardcode?
          .with_units('mg/dL')
          .done();
        postrecords.push(bgRec);
      }

      var rec = cfg.builder.makeWizard()
        .with_recommended({
          carb: wz.recommended_carb_units,
          correction: wz.recommended_correction_units,
          // TODO: this may be wrong, just trying to fill in holes atm
          net: (wz.totalCalculated_units + wz.IOB_units) < 0 ? 0 : (wz.totalCalculated_units + wz.IOB_units)
        })
        .with_bgInput(wz.bg)
        .with_units('mg/dL')
        .with_carbInput(wz.carbInput)
        .with_insulinOnBoard(-wz.IOB_units)
        .with_time(wz.UTCTime)
        .with_deviceTime(wz.deviceTime)
        .with_timezoneOffset(wz.timezoneOffset)
        .with_bolus(refBolus)
        .with_payload(wz)
        .done();

      postrecords.push(rec);
    }
    return records.concat(postrecords);
  };

  var asanteBuildSettingsRecord = function (data, records) {
    var bgunits = ['mg/dL', 'mmol/L'][data.settings.BGUnitsType];
    var s = data.settings;
    var i;

    var rec = cfg.builder.makeSettings()
      .with_activeSchedule(s.BasalProfile[s.ActiveProfile].Name)
      .with_units({ carb: 'grams', bg: bgunits });

    for (i = 0; i < N_BASAL_PROFILES; ++i) {
      for (var j = 0; j < s.BasalProfile[i].SegmentCount; ++j) {
        rec.add_basalScheduleItem(s.BasalProfile[i].Name, {
          rate: s.BasalProfile[i].Segment[j].Amount_units,
          start: s.BasalProfile[i].Segment[j].startTime_msec
        });
      }
    }

    for (i = 0; i < N_FOOD_PROFILES; ++i) {
      if (s.FoodProfile.StartTime[i] !== -1) {
        rec.add_carbRatioItem({
                                amount: s.FoodProfile.carbRatio_gramsperunit[i],
                                start: s.FoodProfile.startTime_msec[i]
                              });
      }
    }

    for (i = 0; i < N_BG_PROFILES; ++i) {
      if (s.BGProfile.StartTime[i] !== -1) {
        rec.add_insulinSensitivityItem({
                                         amount: s.BGProfile.insulinSensitivity[i],
                                         start: s.BGProfile.startTime_msec[i]
                                       });
      }
    }

    for (i = 0; i < N_TARGET_BGS; ++i) {
      if (s.TargetBG.StartTime[i] !== -1) {
        rec.add_bgTargetItem({
                               low: s.TargetBG.MinBG_mgdl[i],
                               high: s.TargetBG.MaxBG_mgdl[i],
                               start: s.TargetBG.startTime_msec[i]
                             });
      }
    }

    // this seems to be the best guess for a reasonable time for now
    var lastconfigidx = data.basalConfig.length - 1;
    rec.with_time(data.basalConfig[lastconfigidx].UTCTime)
      .with_deviceTime(data.basalConfig[lastconfigidx].deviceTime)
      .with_timezoneOffset(data.basalConfig[lastconfigidx].timezoneOffset);

    return records.concat([rec.done()]);
  };

  var asanteBuildBasalRecords = function (data, records) {
    var postrecords = [];
    for (var i = 0; i < data.basalRecords.length; ++i) {
      var basal = data.basalRecords[i];
      buildTimeItems(basal);

      var rec = cfg.builder.makeScheduledBasal()
        .with_time(basal.UTCTime)
        .with_deviceTime(basal.deviceTime)
        .with_timezoneOffset(basal.timezoneOffset)
        .with_rate(basal.Delivered_units);

      postrecords.push(rec);
    }
    return records.concat(postrecords);
  };

  // this is the probe function passed to connect
  function probe(cb) {
    asanteGetHeader(0, function (err, result) {
      if (err) {
        debug(err);
        cb(err, null);
      } else {
        result.id = 'Asante ' + result.model + ' ' + result.serialNumber;
        cb(null, result);
      }
    });
  }

  var getDeviceId = function (data) {
    return 'Asa' + data.pumpHeader.model + data.pumpHeader.serialNumber;
  };

  return {
    // detect calls cb with an error if the device was not detected, or with
    // a result packet including model, serial number, and an id string
    // Unfortunately, with the Asante, it's a bad idea to call detect, because
    // the device can't be reconnected once you've disconnected.
    // So we just say we're connected.
    detect: function (deviceInfo, cb) {
      return cb(null, deviceInfo);
    },

    setup: function (deviceInfo, progress, cb) {
      debug('Asante Setup!');
      progress(100);
      var data = {deviceInfo: deviceInfo, stage: 'setup'};
      cb(null, data);
    },

    connect: function (progress, data, cb) {
      debug('Asante Connect!');
      progress(0);
      cfg.deviceComms.connect(data.deviceInfo, asantePacketHandler, probe, function(err) {
        if (err) {
          return cb(err);
        }
        cfg.deviceComms.flush();
        progress(100);
        data.stage = 'connect';
        cb(null, data);
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('Asante GetConfigInfo!');
      progress(0);
      asanteGetHeader(0, function (err, result) {
        data.stage = 'getConfigInfo';
        progress(100);
        data.pumpHeader = result;
        if (err) {
          return cb(err, data);
        } else {
          debug('getConfigInfo', data);
          var version = data.pumpHeader.pumpRecordVersion;
          if (!setupUsefulConstants(version)) {
            err = 'ERROR: UNKNOWN PUMP VERSION ' + version;
            return cb(err, data);
          }
          data.deviceId = getDeviceId(data);
          cfg.builder.setDefaults({ deviceId: data.deviceId });

          return cb(null, data);
        }
      });
    },

    fetchData: function (progress, data, cb) {
      debug('Asante FetchData!');
      progress(0);
      asanteSetBaudRate(57600, function(e, r) {
        if (e) {
          return cb(e, r);
        }
        asanteFetch(progress, function (err, result) {
          debug('fetchData callback');
          progress(100);
          data.stage = 'fetchData';
          data = _.assign(data, result);
          if (err) {
            return cb(err, data);
          } else {
            return cb(null, data);
          }
        });
      });
    },

    processData: function (progress, data, cb) {
      debug('Asante ProcessData!');
      data.stage = 'processData';
      progress(0);
      var err = asantePostprocess(data);
      progress(100);
      if (err) {
        return cb(err, data);
      } else {
        cb(null, data);
      }
    },

    uploadData: function (progress, data, cb) {
      debug('Asante UploadData!');
      data.stage = 'uploadData';
      progress(0);

      var postrecords = [], settings = null;
      postrecords = asanteBuildSettingsRecord(data, postrecords);
      if (!_.isEmpty(postrecords)) {
        settings = postrecords[0];
      }
      postrecords = asanteBuildBolusRecords(data, postrecords);
      postrecords = asanteBuildWizardRecords(data, postrecords);
      postrecords = asanteBuildBasalRecords(data, postrecords);
      postrecords = _.sortBy(postrecords, function(d) {
        return d.time;
      });

      var simulator = asanteSimulatorMaker.make({settings: settings});

      for (var i = 0; i < postrecords.length; ++i) {
        var datum = postrecords[i];
        switch (datum.type) {
          case 'basal':
            simulator.basal(datum);
            break;
          case 'bolus':
            simulator.bolus(datum);
            break;
          case 'settings':
            simulator.settings(datum);
            break;
          case 'smbg':
            simulator.smbg(datum);
            break;
          case 'wizard':
            simulator.wizard(datum);
            break;
          default:
            debug('[Hand-off to simulator] Unhandled type!', datum.type);
        }
      }
      simulator.finalBasal();

      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Asante'],
        deviceModel: data.pumpHeader.model,
        deviceSerialNumber: data.pumpHeader.serialNumber,
        deviceId: data.deviceId,
        start: sundial.utcDateString(),
        tzName : cfg.timezone,
        version: cfg.version
      };
      debug('sessionInfo', sessionInfo);

      cfg.api.upload.toPlatform(
        simulator.getEvents(),
        sessionInfo,
        progress,
        cfg.groupId,
        function (err, result) {
          if (err) {
            debug(err);
            progress(100);
            return cb(err, data);
          } else {
            progress(100);
            return cb(null, data);
          }
      });
    },

    disconnect: function (progress, data, cb) {
      debug('Asante Disconnect!');
      progress(0);
      asanteDisconnect(function (err, result) {
        progress(100);
        data.stage = 'disconnect';
        data.disconnect = result;
        if (err) {
          return cb(err, data);
        } else {
          cb(null, data);
        }
      });
    },

    cleanup: function (progress, data, cb) {
      debug('Asante Cleanup!');
      progress(0);
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.disconnect(function () {
        progress(100);
        data.stage = 'cleanup';
        cb(null, data);
      });
    }
  };
};
