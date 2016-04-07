/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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
var annotate = require('../eventAnnotations');
var util = require('util');

var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();

var logic = require('../animas/animasLogic');
var animasSimulator = require('../animas/animasSimulator');

var TZOUtil = require('../TimezoneOffsetUtil');

var debug = require('../bows')('AnimasDriver');

module.exports = function (config) {
  var cfg = _.clone(config);
  debug('animas config: ', cfg);
  var serialDevice = config.deviceComms;
  var animasDeviceId = null;
  var simulator = null;

  if (config.silent) {
    // debug = _.noop;
  }

  var BOM_BYTE = 0xC0;
  var EOM_BYTE = 0xC1;
  var ADDRESS_CONNECT = 0xFF; //used to establish connection

  var RETRIES = 10;

  var CMDS = {
    CONNECT: { value: 0x93, name: 'CONNECT'},
    DISCONNECT: { value: 0x53, name: 'DISCONNECT'},
    HANDSHAKE: {value: 0xBF, name: 'HANDSHAKE'},
    UA: {value: 0x73, name: 'Unnumbered Acknowledge'},
    RI: {value: 0x5249, name: 'RI message (Read)'},
    ACK: {value: 0x11, name: 'Acknowledge'}
  };

  var RECORD_TYPES = {
    SERIALNUMBER : {value: 8, name: 'SERIAL AND MODEL NUMBER'},
    SETTINGS: {value: 15, name: 'MISC. SETTINGS'},
    BOLUS: {value: 21, name: 'BOLUS HISTORY'},
    BASAL: {value: 26, name: 'BASAL HISTORY'},
    PRIME_REWIND: {value: 24, name: 'PRIME-REWIND HISTORY'},
    SUSPEND_RESUME: {value: 25, name: 'SUSPEND-RESUME HISTORY'},
    WIZARD: {value: 38, name: 'WIZARD HISTORY'},
    ALARM: {value: 23, name: 'ALARM HISTORY'},
    BASAL_PROGRAM: {value: 11, name: 'BASAL PROGRAMS'},
    BLOOD_GLUCOSE: {value: 40, name: 'BLOOD GLUCOSE HISTORY'}
  };

  var MODELS = {
    15 : 'IR1285',
    16: 'IR1295'
  };

  var BASAL_TYPES = {
    0 : 'scheduled',
    1 : 'temp'
  };

  var PRIMING_FLAGS = {
    0 : 'blank',
    1 : 'not primed',
    2 : 'tubing',
    3 : 'cannula'
  };

  var BOLUS_TYPE_NAME = {
    NORMAL: {value: 1, name: 'normal'},
    AUDIO: {value: 2, name: 'audio'},
    COMBO: {value: 3, name: 'combo'}
  };

  var BOLUS_TYPE_STATUS = {
    COMPLETED: {value: 3, name: 'completed'},
    CANCELLED: {value: 2, name: 'cancelled'}
  };

  var ALARM_TYPES = {
    ALARM_OCCLUSION1: { value: 145, name: 'Occlusion detected'},
    ALARM_OCCLUSION2: { value: 146, name: 'Occlusion detected'},
    ALARM_OCCLUSION3: { value: 147, name: 'Occlusion detected'},
    ALARM_OCCLUSION4: { value: 148, name: 'Occlusion detected'},
    ALARM_AUTO_OFF: { value: 150, name: 'Auto Off'},
    ALARM_REPLACE_BATTERY: { value: 128, name: 'Replace battery'},
    ALARM_EMPTY_CARTRIDGE: { value: 144, name: 'Empty Cartridge'},
    ALARM_LOW_CARTRIDGE: { value: 178, name: 'Low Cartridge'},
    ALARM_LOW_BATTERY: { value: 177, name: 'Low Battery'}
  };

  var ERRORS = {
    LENGTH_ERROR: { value: 0, name: 'Length error'},
    ITEM_ERROR: { value: 1, name: 'Item error'},
    READ_ERROR: { value: 3, name: 'Read error'},
    COMMAND_ERROR: { value: 4, name: 'Command error'},
    RECORD_NUMBER_ERROR: { value: 5, name: 'Record number error'},
    PUMP_NOT_SUSPENDED: { value: 6, name: 'Pump not suspended'}
  };

  var _getName = function (list, idx) {
    for (var i in list) {
      if (list[i].value === idx) {
        return list[i].name;
      }
    }
    return 'unknown';
  };

  var getCmdName = function (idx) {
    return _getName(CMDS, idx);
  };

  var getAlarmName = function (idx,types) {
    return _getName(types, idx);
  };

  var counters = {
    sent : 0,
    received : 0
  };

  var primaryAddress = null;
  var connectionAddress = null; // 11000000b primary devices sets bit 0 (LSB), bit 1-7 is connection address

  var modelNumber = null;

  var bytes2hex = function(bytes) {
    var message = '';
    for(var i in bytes) {
      message += bytes[i].toString(16).toUpperCase() + ' ';
    }
    return message;
  };

  // builds a command in an ArrayBuffer
  // Byte 1: always 0xC0 (BOM - Beginning of Message),
  // Byte 2: address field; bit 0 is command/response bit (primary device sets this bit, secondary clears it)
  // Byte 3: control field; if bit 4 is clear sender retains transmit rights, if set receiver has transmit rights
  // Payload: 0-128 bytes
  // CRC bytes: 2 check bytes over bytes 2-3 and payload
  // EOM byte: always 0xC1 (signals end of message)

  var buildPacket = function (address, command, payload) {

    var escapedPayload = escapeCharacters(payload);
    var payloadLength = escapedPayload.length;

    // checksum only over address field, control field and payload
    var acp = [];
    acp = acp.concat(address,command,Array.prototype.slice.call(payload));
    var crc = escapeCharacters(crcCalculator.calcCheckBytes(acp));

    var datalen = payloadLength + crc.length + 4; // BOM + address field + control field + EOM = 4
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'bbb', BOM_BYTE, address,command);

    ctr += struct.copyBytes(bytes, ctr, escapedPayload, payloadLength);
    ctr += struct.copyBytes(bytes, ctr, crc, crc.length);
    struct.pack(bytes, ctr, 'b', EOM_BYTE);

    debug('bytes sent:', bytes2hex(bytes));
    return buf;
  };

  var escapeCharacters = function(buf) {
    var escaped = [];
    for(var i = 0; i < buf.length; i++) {
      var byte = buf[i];
      if(byte === BOM_BYTE || byte === EOM_BYTE || byte === 0x7D) {
        debug('Replacing special character');
        escaped.push(0x7D);
        escaped.push(byte ^ 0x20);
      }
      else{
        escaped.push(byte);
      }
    }
    return escaped;
  };

  var setupConnection = function(destinationAddress) {
    var payload = [];
    var payloadlength = struct.copyBytes(payload, 0, primaryAddress, 4);
    payloadlength += struct.pack(payload,4,'ib',destinationAddress,connectionAddress);
    return {
      packet: buildPacket(
        ADDRESS_CONNECT, CMDS.CONNECT.value, payload
      ),
      parser: function (packet) {
        var data = {connected : (packet.command == CMDS.UA.value)};
        return data;
      }
    };
  };

  var handshake = function(iter) {
    return {
      packet: buildPacket(
        ADDRESS_CONNECT, CMDS.HANDSHAKE.value, primaryAddress.concat([0xFF,0xFF,0xFF,0xFF,0x02,iter])
      ),
      parser: function (packet) {
        var data = {
          destinationAddress : struct.extractInt(packet.payload, 0),
          serialNumber : struct.extractInt(packet.payload,10),
          description : struct.extractString(packet.payload,14,packet.length-1)
        };
        return data;
      }
    };
  };

  var getCounters = function() {
    // bit 5-7 : 3-bit receive counter
    // bit 4 : 1
    // bit 1-3 : 3-bit send counter
    // bit 0:  0
    var counter = (counters.received << 5) | 0x10;
    counter = (counters.sent << 1) | counter;
    console.log('Counter: ', counter.toString(2));
    return counter;
  };

  var incrementSentCounter = function() {
    counters.sent +=1;
    if(counters.sent == 7) {// counter is only 3 bits
      counters.sent = 0;
    }
  };

  var incrementReceivedCounter = function() {
    counters.received += 1;
    if(counters.received == 7) { // counter is only 3 bits
      counters.received = 0;
    }
  };

  var decrementReceivedCounter = function() {
    if(counters.received === 0) { // counter is only 3 bits
      counters.received = 7;
    }
    else {
      counters.received -= 1;
    }
  };

  var readDataPages = function (rectype, offset, numRecords) {

    var payload = new Uint8Array(8);
    var payloadlength = struct.pack(payload,0,'Ssss',CMDS.RI.value,rectype,offset,numRecords);

    return {
      packet: buildPacket(
        connectionAddress,
        getCounters(),
        payload
      ),
      parser: function (packet) {
        return packet;
      }
    };
  };

  var requestPrimeRewind = function() {
    return{
      recordType: RECORD_TYPES.PRIME_REWIND.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractShort(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          deliveredAmount: struct.extractShort(payload,8)/100.0, // U x 100
          primeFlags: PRIMING_FLAGS[struct.extractByte(payload,10)]
        };
      }
    };
  };

  var requestSuspendResume = function() {
    return{
      recordType: RECORD_TYPES.SUSPEND_RESUME.value,
      parser : function (payload) {
        var suspenddt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        var resumedt = decodeDate(struct.unpack(payload,8,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractShort(payload,2),
          suspendJsDate : suspenddt,
          suspendDeviceTime: sundial.formatDeviceTime(suspenddt),
          resumeJsDate : resumedt,
          resumeDeviceTime: sundial.formatDeviceTime(resumedt)
        };
      }
    };
  };

  var requestBolus = function() {
    return{
      recordType: RECORD_TYPES.BOLUS.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractShort(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          deliveredAmount: struct.extractInt(payload,8)/10000.0, // U x 10,000
          requiredAmount: struct.extractShort(payload,12)/1000.0, // U x 1,000
          duration: struct.extractShort(payload,14)*0.1*60*60*1000, // N x 0.1Hr
          bolusType: getBolusType(struct.extractByte(payload,16)),
          sync_counter: struct.extractByte(payload,17)
        };
      }
    };
  };

  var requestBasal = function() {
    return{
      recordType: RECORD_TYPES.BASAL.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index : struct.extractShort(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          rate: struct.extractShort(payload,8)/1000.0, // U x 1,000
          basalType: BASAL_TYPES[parseInt(struct.extractByte(payload,10),10)]
        };
      }
    };
  };

  var requestBasalProgram = function() {
    return{
      recordType: RECORD_TYPES.BASAL_PROGRAM.value,
      parser : function (payload) {
        var valid = struct.extractByte(payload,4);

        if(valid === 1) {
          var number_segments = struct.extractByte(payload,5);
          var schedules = [];
          var encodedTimes = struct.extractBytes(payload,6,12);
          var encodedRates = struct.extractBytes(payload,18,24);
          for(var i = 0; i < number_segments; i++ ) {
            var startTime = encodedTimes[i] * 30 * sundial.MIN_TO_MSEC;
            var rate = struct.extractShort(encodedRates, i*2);
            schedules.push( { startTime: startTime, basalRate: rate} );
          }

          return {
            index : struct.extractShort(payload,2),
            schedules : schedules
          };
        }
        else {
          return {
            index : struct.extractShort(payload,2)
          };
        }
      }
    };
  };

  var requestWizard = function() {
    return{
      recordType: RECORD_TYPES.WIZARD.value,
      parser : function (payload) {
        var wizardConfig = getWizardConfig(struct.extractByte(payload,15));
        return {
          index : struct.extractShort(payload,2),
          sync_counter: struct.extractByte(payload,4),
          carb_ratio: struct.extractByte(payload,5),
          carb_amount: struct.extractShort(payload,6),
          isf: struct.extractShort(payload,8),
          bg: struct.extractShort(payload,10),
          target_bg: struct.extractShort(payload,12),
          bg_delta: struct.extractByte(payload,14), //shape
          configuration: wizardConfig,
          iob: struct.extractShort(payload,16) / 100.0
        };
      }
    };
  };

  var requestAlarm = function() {
    return{
      recordType: RECORD_TYPES.ALARM.value,
      parser : function (payload) {
        var dt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        return {
          index: struct.extractShort(payload,2),
          jsDate: dt,
          deviceTime: sundial.formatDeviceTime(dt),
          eaw_code: struct.extractByte(payload,8), // eaw = errors, alarms and warnings
          engineering_code: struct.extractBytes(payload,9,9)
        };
      }
    };
  };

  var requestBG = function() {
    //TODO: on Vibe these will be CGM calibration records
    return{
      recordType: RECORD_TYPES.BLOOD_GLUCOSE.value,
      parser : function (payload) {
        var BASE_TIME = Date.UTC(2000, 0, 1, 0, 0, 0).valueOf();
        var bytes = struct.extractBytes(payload,8,3);
        var counter = (bytes[2] << 16) + (bytes[1] << 8) + bytes[0];
        var dt = new Date(BASE_TIME + counter * sundial.MIN_TO_MSEC);
        var pumpdt = decodeDate(struct.unpack(payload,4,'bbbb',['monthYear','day','hour','minute']));
        var bgBytes = struct.extractBytes(payload,11,3);
        // first 10 bits is glucose value, range 0-1023
        var bg = ((bgBytes[1] & 0x03) << 8) + bgBytes[0];
        var controlSolution = bgBytes[1] & 0x04 ? true : false;
        return {
          index : struct.extractShort(payload,2),
          jsDate : dt,
          deviceTime: sundial.formatDeviceTime(dt),
          pumpTime: sundial.formatDeviceTime(pumpdt),
          bg: bg,
          controlSolution: controlSolution
        };
      }
    };
  };

  // accepts a stream of bytes and tries to find a packet
  // at the beginning of it.
  // returns a packet object; if valid == true it's a valid packet
  // if packet_len is nonzero, that much should be deleted from the stream
  // if valid is false and packet_len is nonzero, the previous packet
  // should be NAKed.
  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      command: 0,
      payload: null,
      crc: 0
    };

    if (bytes[0] != BOM_BYTE) {
      return packet;
    }

    // wait until we've received the end of message
    if (bytes[bytes.length-1] !== EOM_BYTE) {
      return packet;  // we're not done yet
    }

    debug('Raw packet: ', bytes2hex(bytes));

    //escape characters
    var fromIndex = 0;
    var index = 0;
    while((index = bytes.indexOf(0x7D,fromIndex)) > 0) {
        debug('Replacing escaped character');
        var buf = new Uint8Array(bytes.byteLength-1);
        var front = bytes.slice(0,index+1);
        var special = bytes[index+1] ^ 0x20;
        front[index] = special;
        if(special == 0x7D) {
          fromIndex = index+1; // previous escaped character was the escape character
        }
        buf.set(front,0);
        buf.set(bytes.slice(index+2),index+1);
        debug('Escaped bytes:', bytes2hex(buf));
        bytes = buf;
    }

    // calc the checksum
    packet.crc = struct.extractBytes(bytes, bytes.length - 3,2);
    var crc = crcCalculator.calcCheckBytes(bytes.subarray(1,bytes.length-3));
    if ((crc[0] !== packet.crc[0]) || (crc[1] !== packet.crc[1])) {
      // if the crc is bad, we should discard the whole packet
      debug('Invalid CRC');
      cfg.deviceComms.flush();
      return packet;
    }

    // command is the third byte, packet is remainder of data
    packet.command = bytes[2];
    packet.packet_len = bytes.length;

    if((packet.packet_len == 6) && (packet.command & CMDS.ACK.value)) {
      // This is a Receive Ready/NOP/Ack packet
      packet.ack = true;
      var nextPacket = struct.extractByte(bytes, 2);
      counters.received = nextPacket >> 5;
      packet.valid = true;
    }
    else if ((bytes[3] == 0x45) && (bytes[4] == 0x00)) {
      // This is an error message from the pump
      packet.valid = true;
      packet.error = _getName(ERRORS, bytes[5]);
      console.log('Error message from pump:', packet.error);
      return packet;
    }
    else {
      packet.payload = new Uint8Array(packet.packet_len-6);
      for (var i = 0; i < bytes.length - 6; ++i) {
        packet.payload[i] = bytes[i + 3];
      }
      packet.valid = true;
    }

    return packet;
  };

  var parsePayload = function (packet) {

    if (!packet.valid) {
      return {};
    }
    if (packet.command !== 1) {
      return {};
    }

    var len = packet.packet_len - 6;
    var data = null;
    if (len) {
      console.log(struct.extractString(packet.payload, 0, len));
    }
    return data;
  };

  var animasPacketHandler = function (buffer) {
    // for efficiency reasons, we're not going to bother to ask the driver
    // to decode things that can't possibly be a packet
    // first, discard bytes that can't start a packet
    var discardCount = 0;
    while (buffer.len() > discardCount && buffer.get(0) != BOM_BYTE) {
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
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT:', commandpacket.packet);
      callback(new Error('Timeout error'), null);
    }, timeout);

    var listenTimer = setInterval(function () {
      if (serialDevice.hasAvailablePacket()) {
        var pkt = serialDevice.nextPacket();
        debug('Received packet: ', pkt);
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);

        if (pkt.error) {
          //TODO: retry from some types of errors
          return callback(new Error(pkt.error),null);
        }
        // only attempt to parse the payload if it worked
        if (pkt.payload) {
          pkt.parsed_payload = commandpacket.parser(pkt);
        }
        callback(null, pkt);
      }
    }, 1);
  };

  var sendAck = function (obj,cb) {
    var cmd = {
      packet: buildPacket(
        connectionAddress, CMDS.ACK.value | (counters.received << 5), []
      ),
      parser: function (packet) {
        var data = {
          nextPacket : struct.extractByte(packet.payload, 0)
        };
        return data;
      }
    };

    animasCommandResponse(cmd, true, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        cb(null, result);
      }
    });
  };

  var animasCommandResponse = function (commandpacket, retry, callback) {
    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      listenForPacket(1000, commandpacket, function(err, result) {
        if(err) {
          if(err.message == 'Timeout error' && retry) {
            cfg.deviceComms.flush();
            debug('Retrying after timeout..');
            var waitTimer = setTimeout(function () {
              serialDevice.writeSerial(commandpacket.packet, function () {
                // once we've sent the command, start listening for a response
                listenForPacket(1000, commandpacket, function(err, result) {
                  if (err) {
                    callback(err, null);
                  } else {
                    callback(null, result);
                  }
                });
              });
            },1000);
          }
          else {
            callback(err, null);
          }
        }
        else{
          callback(null,result);
        }
      });
    });
  };

  var animasCommandResponseAck = function (cmd, cb) {
    // This is for Information packets, where one ACK is received after the command is sent,
    // and an ACK is sent in response. When the payload is received, another ACK is sent.

    var retry = function (cb, results) {
      console.log('Sending ack and then command again..');
      incrementReceivedCounter();
      sendAck(true, function (err, result){
        if(err) {
          return cb(err, null);
        }
        if(result.ack) {
          animasCommandResponse(cmd, true, function (err, result) {
            if (err) {
              cb(err, null);
            } else {
              if(result.payload && result.payload[0] === 0x44 && result.payload[1] === 0x49) {
                //TODO: double-check extra checksum
                sendAck(true, function (err, ackResult){
                  if(err) {
                    return cb(err, null);
                  }
                  return cb(null,result);
                });
              }else{
                cb(new Error('Pump not sending data. Please retry.'), null);
              }
            }
          });
        } else {
          if(result.payload && result.payload[0] === 0x44 && result.payload[1] === 0x49) {
            //TODO: double-check extra checksum
            sendAck(true, function (err, ackResult){
              if(err) {
                return cb(err, null);
              }
              return cb(null,result);
            });
          } else {
            return cb(new Error('Unknown packet'), null);
          }
        };
      });
    };

    animasCommandResponse(cmd, true, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        if(result.ack) {
          incrementSentCounter();
          sendAck(true, function (err, result){
            if(err) {
              return cb(err, null);
            }
            incrementReceivedCounter();
            if(result.payload && result.payload[0] === 0x44 && result.payload[1] === 0x49) {
              //TODO: double-check extra checksum
              sendAck(true, function (err, ackResult){
                if(err) {
                  return cb(err, null);
                }
                return cb(null,result);
              });
            }else {
              async.retry(RETRIES, retry, function(err, result) {
                if (err) {
                  cb(err, null);
                } else {
                  cb(null,result);
                }
              });
            }
          });
        }
        else {
          //it's possible that we're receiving diagnostic echo messages,
          //so retry command
          async.retry(RETRIES, retry, function(err, result) {
            if (err) {
              cb(err, null);
            } else {
              cb(null,result);
            }
          });
        }
      }
    });
  };

  var discoverDevice = function(cb) {
    debug('discovering animas device');
    primaryAddress = [0x01,0x00,0x00,0x00];
    connectionAddress = 0x03; // use connection address with LSB as 1

    var i = 0;
    var handshakeInterval = setInterval(function() {
      debug('Polling slot ',i);
      var cmd = handshake(i);
      i++;
      if(i === 16) {
        clearInterval(handshakeInterval);
        debug('Did not find device.');
        return cb(new Error('Make sure your screen is active and not dark.'),null);
      }

      animasCommandResponse(cmd, false, function (err, result) {
        if (result) {
          clearInterval(handshakeInterval);
          cb(null, result);
        }
      });

    }, 200); // discovery timeout is 100ms, we wait a bit longer

  };

  var getConnection = function(obj, cb) {
    debug('connecting to animas');
    var i = 0;
    var connectInterval = setInterval(function() {
      debug('Attempt ',i);
      var cmd = setupConnection(obj.parsed_payload.destinationAddress);
      i++;
      if(i == 8) {
        clearInterval(connectInterval);
        debug('Could not connect to device.');
        cb(new Error('Make sure your pump is suspended.'),null);
      }

      animasCommandResponse(cmd, false, function (err, result) {
        if (result) {
          clearInterval(connectInterval);
          cb(null, result);
        }
      });
    }, 1000);
  };

  var resetConnection = function(obj, cb) {
    cfg.deviceComms.setPaused(false);

    debug('reset connection to animas');
    var cmd = {
      packet: buildPacket(
        connectionAddress, CMDS.CONNECT.value, []
      ),
      parser: function (packet) {
        if (packet.command == CMDS.UA.value) {
          var data = {wasReset: true};
          return data;
        }
        return false;
      }
    };

    animasCommandResponse(cmd, false, function (err, result) {
      if(err) {
        return cb(err,null);
      }
      return cb(null, result);
    });
  };


  var readSerialandModelNumber = function(cb) {
    var cmd = readDataPages(RECORD_TYPES.SERIALNUMBER.value,0,1);
    animasCommandResponseAck(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        var model = struct.extractString(result.payload,10,2);
        var data = {
          modelNumber : MODELS[parseInt(model,10)],
          serialNumber: struct.extractString(result.payload,12,2).concat('-',struct.extractString(result.payload,4,6),model),
          month: String.fromCharCode(struct.extractByte(result.payload,14)), // hex month: 1=January .. C=December
          year: String.fromCharCode(struct.extractByte(result.payload,15)) //hex year
        };
        modelNumber = data.modelNumber;
        cb(null, data);
      }
    });
  };

  //TODO: not used yet
  var readMiscSettings = function(cb) {
      var cmd = readDataPages(RECORD_TYPES.SETTINGS.value,0,1);
      animasCommandResponseAck(cmd, function (err, result) {
        if (err) {
          cb(err, null);
        } else {
          var data = {
            insulinSensitivity : struct.extractShort(result.payload,10),
            bgTarget: struct.extractShort(result.payload,8)
          };
          cb(null, data);
        }
      });
  };

  var getNumberOfRecords = function(rectype, cb) {
    var cmd = readDataPages(rectype,0,0);
    animasCommandResponseAck(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        if(result.payload.length !== 6) {
          return cb(new Error('Invalid packet sent by pump'),null);
        }
        var data = {
          numRecords : struct.extractShort(result.payload,2),
          recordSize: struct.extractShort(result.payload,4)
        };
        cb(null,data);
      }
    });
  };

  var getBolusType = function(byte) {
    var type = {};

    var name = byte & 0x03;
    type.name = _getName(BOLUS_TYPE_NAME, name);

    var status = (byte >> 2) & 0x03;
    type.status = _getName(BOLUS_TYPE_STATUS, status);

    var triggeredBy = (byte >> 4) & 0x01;
    switch (triggeredBy) {
      case 0:
        type.triggeredBy = 'pump';
        break;
      case 1:
        type.triggeredBy = 'RF remote';
        break;
      default:
        debug('Unhandled type!', triggeredBy);
    }

    if(type.status === BOLUS_TYPE_STATUS.CANCELLED.name) {

      var cancelledBy = (byte >> 5) & 0x01;
      switch (cancelledBy) {
        case 0:
          type.cancelledBy  = 'pump';
          break;
        case 1:
          type.cancelledBy  = 'RF remote';
          break;
        default:
          debug('Unhandled type!', cancelledBy);
      }
    }

    var bgOrCarbTriggered = (byte >> 6) & 0x03;
    switch (bgOrCarbTriggered) {
      case 0:
        type.bgOrCarbTriggered = 'neither';
        break;
      case 1:
        type.bgOrCarbTriggered = 'bg';
        break;
      case 2:
        type.bgOrCarbTriggered = 'carb';
        break;
      case 3:
        type.bgOrCarbTriggered = 'both';
        break;
      default:
        debug('Unhandled type!', bgOrCarbTriggered);
    }

    return type;
  };

  var getWizardConfig = function(byte) {
    var wizardConfig = {};

    var units = (byte >> 1) & 0x01;
    wizardConfig.units = units ? 'mmol/L' : 'mg/dL';

    var iob = (byte >> 2) & 0x01;
    wizardConfig.iobEnabled = iob ? true : false;

    var correction = (byte >> 3) & 0x01;
    wizardConfig.correctionAdded = correction ? true : false;

    // TODO: the spec is not clear on how to decode IOB duration,
    // so we're not including this for now.
    //var duration = (byte >> 4) & 0x0F;
    //wizardConfig.iobDuration = duration;

    return wizardConfig;
  };

  var decodeDate = function(encoded) {
    var startYear = null;
    if (modelNumber === 'IR1285') {   // OneTouch Ping starts in year 2007 as 0
      startYear = 2007;
    } else if (modelNumber === 'IR1295') {
      startYear = 2008; // Animas Vibe starts in 2008
    } else {
      throw new Error('Unknown device model number');
    }
    var year = (encoded.monthYear & 0x0f) + startYear;
    var month = (encoded.monthYear >> 4); // January = 0
    var date = sundial.buildTimestamp({year:year,month:month+1,day:encoded.day,hours:encoded.hour,minutes:encoded.minute,seconds:0});
    return date;
  };

  var getRecords = function(request,numRecords,percentage,progress,cb) {

    var cmd = readDataPages(request.recordType,0,numRecords);
    var firstPass = true;
    var records = [];
    var prevPercentage = 0;

    animasCommandResponseAck(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {

        // sometimes, the same record is returned twice, so we have to check
        // the record index until we know we're at the last one
        var datum = {index:-1};
        async.whilst(function () { return datum.index+1 < numRecords; }, function(next){
          console.log('Retrieving', datum.index+1,'of',numRecords);

          var newPercentage = (datum.index/numRecords)*10+(10-percentage);
          if(newPercentage > (prevPercentage+1)) {
            // only update progress to UI if there's an increase of at least 1 percent
            prevPercentage = newPercentage;
            progress(newPercentage);
          }

          var parsePayload = function(result) {
            var payload = result.payload;
            datum = request.parser(payload);
            console.log('Datum:', datum);

            if(struct.extractInt(payload,4) === 0) {// empty date
              datum.empty = true;
            }
            else{
              datum.empty = false;
            }

            //TODO: double-check extra checksum
            sendAck(true, function (err, result){
              if(err) {
                return cb(err, null);
              }
              records.push(datum);
              return next(err,records);
            });
          };

          // on the first pass, we may already have a payload
          if(firstPass && result) {
            parsePayload(result);
          }
          else {
            sendAck(true, function (err, result){
              if(err) {
                return cb(err, null);
              } else {
                incrementReceivedCounter();
                if(result.payload) {
                  parsePayload(result);
                }
                else if(result.ack) {

                  console.log('Waiting..');
                  var waitTimer = setTimeout(function () {
                    console.log('and retrying..', result);
                    animasCommandResponse(cmd, true, function (err, result) {
                      if(err) {
                        return cb(err, null);
                      }
                      if(result.payload) {
                        parsePayload(result);
                      }
                      else {
                        incrementSentCounter();
                        sendAck(true, function (err, result){
                          if(err) {
                            return cb(err, null);
                          }
                          incrementReceivedCounter();
                          if(result.payload) {
                            parsePayload(result);
                          }else if(result.ack){
                            return cb(new Error('Pump not responding as expected. Please retry.'), null);
                          }else{
                            cb(new Error('Unknown packet received'), null);
                          }
                        });
                      }
                    });
                  }, 1000);
                }
              }
            });
          }
          firstPass = false;

        }, function(err, result) {
          // remove empty and invalid records
          _.remove(result, function (item) { return item.empty || item.jsDate === null;});
          cb(null,result);
        });
      }
    });
  };

  function buildBolusRecords(data, postrecords) {
    var bolus = null;
    for(var b in data.bolusRecords) {
      var bolusdatum = data.bolusRecords[b];

      if(bolusdatum.bolusType.name === BOLUS_TYPE_NAME.COMBO.name) {
        bolus = cfg.builder.makeDualBolus();
        // for combo boluses, we don't know the split between immediate and extended
        // portions, so we split it 50:50 and annotate
        annotate.annotateEvent(bolus, 'animas/bolus/extended-equal-split');

        if(bolusdatum.bolusType.status === BOLUS_TYPE_STATUS.CANCELLED.name) {
          // extended bolus was cancelled
          var halfExpected = bolusdatum.requiredAmount/2;
          var normal = null;
          var extended = null;
          if (bolusdatum.deliveredAmount > halfExpected ) {
            normal = halfExpected;
            extended = bolusdatum.deliveredAmount - halfExpected;
          }
          else {
            normal = bolusdatum.deliveredAmount;
            extended = 0;
          }
          bolus = bolus.with_expectedNormal(halfExpected)
            .with_normal(normal)
            .with_extended(extended)
            .with_expectedExtended(halfExpected)
            .with_expectedDuration(bolusdatum.duration)
            .with_duration(0)
            .with_payload({
              triggeredBy: bolusdatum.bolusType.triggeredBy,
              cancelledBy: bolusdatum.bolusType.cancelledBy,
              bgOrCarbTriggered: bolusdatum.bolusType.bgOrCarbTriggered
            });
          // if an extended bolus is cancelled, we don't know the actual duration
          annotate.annotateEvent(bolus, 'animas/bolus/unknown-duration');
        } else {
          // extended bolus completed
          bolus = bolus.with_duration(bolusdatum.duration)
          .with_normal(bolusdatum.deliveredAmount/2)
          .with_extended(bolusdatum.deliveredAmount/2)
          .with_payload({
            triggeredBy: bolusdatum.bolusType.triggeredBy,
            bgOrCarbTriggered: bolusdatum.bolusType.bgOrCarbTriggered
          });
        }

      } else {
        bolus = cfg.builder.makeNormalBolus()
          .with_normal(bolusdatum.deliveredAmount)
          .with_payload({
            triggeredBy: bolusdatum.bolusType.triggeredBy,
            bgOrCarbTriggered: bolusdatum.bolusType.bgOrCarbTriggered
          });

        if(bolusdatum.bolusType.name === BOLUS_TYPE_NAME.AUDIO.name) {
          bolus = bolus.with_payload({
                        quickBolus: bolusdatum.bolusType.name
                      });
        }

        if(bolusdatum.bolusType.status === BOLUS_TYPE_STATUS.CANCELLED.name) {
          bolus = bolus.with_expectedNormal(bolusdatum.requiredAmount)
            .with_payload({
              triggeredBy: bolusdatum.bolusType.triggeredBy,
              cancelledBy: bolusdatum.bolusType.cancelledBy,
              bgOrCarbTriggered: bolusdatum.bolusType.bgOrCarbTriggered
            });
        }
      }

      bolus = bolus.with_deviceTime(bolusdatum.deviceTime)
          .set('index', bolusdatum.index)
          .set('syncCounter', bolusdatum.sync_counter)
          .set('requiredAmount', bolusdatum.requiredAmount);

      cfg.tzoUtil.fillInUTCInfo(bolus, bolusdatum.jsDate);
      bolus = bolus.done();
      postrecords.push(bolus);
    }

    return postrecords;
  }

  function buildWizardRecords(data, postrecords) {
    var wizard = null;
    for(var b in data.wizardRecords) {
      var wizarddatum = data.wizardRecords[b];
      var bolusdatum = postrecords[b];

      if(bolusdatum.payload.bgOrCarbTriggered === undefined || bolusdatum.payload.bgOrCarbTriggered === 'neither') {
        // don't build wizard records if it wasn't actually triggered by ezBG or ezCarb,
        // the wizard data will be stale and from a previous record
        continue;
      }

      // bolus and wizard records must be matched to fill in timestamp
      // needed for sorting, before passing to simulator
      if (bolusdatum.syncCounter !==  wizarddatum.sync_counter) {
        //TODO: see if this happens
        throw Error('Wizard bolus mismatch!', bolusdatum.syncCounter, wizarddatum.sync_counter);
      }
      else {

        var bg = null;
        if(bolusdatum.payload.bgOrCarbTriggered === 'bg' ||
          (bolusdatum.payload.bgOrCarbTriggered === 'carb' && wizarddatum.configuration.correctionAdded) ) {

          bg = wizarddatum.bg;

          // Animas uses 1-minute resolution, so we add 30 seconds to manual
          // value to ensure it's always after any potential duplicate linked values
          var t = new Date(bolusdatum.time);
          t.setSeconds(t.getSeconds() + 30);
          t = t.toISOString();

          var bgRecord = cfg.builder.makeSMBG()
            .with_subType('manual')
            .with_value(bg)
            .with_units(wizarddatum.configuration.units)
            .set('index',wizarddatum.index)
            .with_deviceTime(sundial.formatDeviceTime(t))
            .with_time(t)
            .with_timezoneOffset(bolusdatum.timezoneOffset)
            .with_conversionOffset(bolusdatum.conversionOffset)
            .with_clockDriftOffset(bolusdatum.clockDriftOffset);
          bgRecord.done();
          postrecords.push(bgRecord);
        }

        // Animas does not provide recommended/suggested amount,
        // so we're using the required amount and annotating
        var carb = 0;
        var correction = 0;
        var net = 0;
        if (  (bolusdatum.payload.bgOrCarbTriggered === 'carb') && (wizarddatum.carb_amount > 0) ) {
          carb = logic.calculateCarbRecommendation(wizarddatum);
        }

        if (bg !== null) {
          correction = logic.calculateCorrectionRecommendation(wizarddatum);
        }

        net = logic.calculateNetRecommendation(wizarddatum, bolusdatum.payload.bgOrCarbTriggered);

        wizard = cfg.builder.makeWizard()
          .with_insulinOnBoard(wizarddatum.iob)
          .with_insulinSensitivity(wizarddatum.isf)
          .with_bgTarget({
            target: wizarddatum.target_bg,
            range: wizarddatum.bg_delta
          })
          .with_recommended({
            carb: carb.toFixedNumber(2),
            correction: correction.toFixedNumber(2),
            net: net
          })
          .with_bolus(bolusdatum)
          .with_units(wizarddatum.configuration.units)
          .with_deviceTime(bolusdatum.deviceTime)
          .with_time(bolusdatum.time)
          .with_timezoneOffset(bolusdatum.timezoneOffset)
          .with_conversionOffset(bolusdatum.conversionOffset)
          .with_clockDriftOffset(bolusdatum.clockDriftOffset)
          .with_payload(wizarddatum.configuration)
          .set('index', wizarddatum.index);
          //TODO: annotate.annotateEvent(wizard, 'animas/bolus/required-as-suggested');

        if (bg !== null) {
          wizard = wizard.with_bgInput(bg);
        }

        if((bolusdatum.payload.bgOrCarbTriggered === 'carb') ||
            (bolusdatum.payload.bgOrCarbTriggered === 'both')) {
          wizard = wizard.with_carbInput(wizarddatum.carb_amount)
                         .with_insulinCarbRatio(wizarddatum.carb_ratio);
        }

        wizard = wizard.done();
        postrecords.push(wizard);
      }
    }

    return postrecords;
  }

  function buildAlarmRecords (data, postrecords) {
    var alarm = null;
    for(var b in data.alarmRecords) {
      var alarmdatum = data.alarmRecords[b];
      //TODO: process and store alarm records
      var alarmRecord = cfg.builder.makeDeviceEventAlarm()
        .with_deviceTime(alarmdatum.deviceTime)
        .set('index', alarmdatum.index);
      cfg.tzoUtil.fillInUTCInfo(alarmRecord, alarmdatum.jsDate);

      if(alarmdatum.eaw_code != null) {
        var alarmValue = alarmdatum.eaw_code;
        var alarmText = getAlarmName(alarmValue,ALARM_TYPES);
        var postbasal = null;

        switch (alarmValue) {
          case ALARM_TYPES.ALARM_OCCLUSION1.value:
          case ALARM_TYPES.ALARM_OCCLUSION2.value:
          case ALARM_TYPES.ALARM_OCCLUSION3.value:
          case ALARM_TYPES.ALARM_OCCLUSION4.value:
            alarmRecord = alarmRecord.with_alarmType('occlusion');
            break;
          case ALARM_TYPES.ALARM_AUTO_OFF.value:
            alarmRecord = alarmRecord.with_alarmType('auto_off');
            break;
          case ALARM_TYPES.ALARM_LOW_CARTRIDGE.value:
            alarmRecord = alarmRecord.with_alarmType('low_insulin');
            break;
          case ALARM_TYPES.ALARM_EMPTY_CARTRIDGE.value:
            alarmRecord = alarmRecord.with_alarmType('no_insulin');
            break;
          case ALARM_TYPES.ALARM_LOW_BATTERY.value:
            alarmRecord = alarmRecord.with_alarmType('low_power');
            break;
          case ALARM_TYPES.ALARM_REPLACE_BATTERY.value:
            alarmRecord = alarmRecord.with_alarmType('no_power');
            break;
          default:
            alarmRecord = alarmRecord.with_alarmType('other');
            alarmRecord = alarmRecord.with_payload({alarm_id: alarmValue});
        }
      }

      alarmRecord = alarmRecord.done();
      postrecords.push(alarmRecord);
    };

    return postrecords;
  }

  function buildBGRecords(data, postrecords) {
    data.bgRecords.forEach(function (bgEntry) {

      if (!bgEntry.controlSolution) {
        var bgRecord = cfg.builder.makeSMBG()
          .with_deviceTime(bgEntry.deviceTime)
          .with_subType('linked')
          .with_value(bgEntry.bg)
          .with_units('mg/dL')  //TODO: get from settings?
          .set('index',bgEntry.index)
          .with_payload({
            pumpTime: bgEntry.pumpTime
          });
        cfg.tzoUtil.fillInUTCInfo(bgRecord, bgEntry.jsDate);
        bgRecord.done();
        postrecords.push(bgRecord);
      }
      else {
        console.log('Discarding control solution test');
      }
    });
    return postrecords;
  }

  // this is the probe function passed to connect
  function probe(cb) {
    cb();
  }

  return {
     detect: function (obj, cb) {
       //TODO: look at putting default detect function back in
       debug('Animas not using detect function');
       cb(null,obj);
     },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      debug('STEP: setup');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('STEP: connect');
      cfg.deviceComms.connect(data.deviceInfo, animasPacketHandler, probe, function(err) {
        if (err) {
          return cb(err,null);
        }

        discoverDevice(function(discoverErr, result) {
          if(discoverErr) {
            return cb(discoverErr, null);
          }else{
            getConnection(result, function(connectErr, obj) {
              if(connectErr) {
                cb(connectErr, null);
              }else{
                if(obj.parsed_payload.connected === true) {
                          // we're talking so tell the serial device to record this port
                          cfg.deviceComms.recordPort(data.deviceInfo.driverId);
                          // reset packet counters
                          counters.sent = 0;
                          counters.received = 0;

                          progress(100);
                          data.connect = true;
                          cb(null, data);
                }else{
                  debug('Not connected.');
                  cb(new Error('Not connected'),null);
                }
              }
            });
          }
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('STEP: getConfigInfo');
      resetConnection(true, function(connectErr, obj) {
        if(connectErr) {
          cb(connectErr, obj);
        }else{
          readSerialandModelNumber(function (err, result) {
            if(err) {
              debug('Resetting and trying again..');
              resetConnection(true, function(connectErr, obj) {
                if(connectErr) {
                  return cb(connectErr, null);
                }else{
                  readSerialandModelNumber(function (err, result) {
                    if(err) {
                      // give up
                      return cb(err, null);
                    }else{
                      progress(100);
                      data.settings = result;
                      data.getConfigInfo = true;
                      cb(null, data);
                    }
                  });
                };
              });
            }else{
              progress(100);
              data.settings = result;
              data.getConfigInfo = true;
              cb(null, data);
            }
          });
        }
      });
    },

    fetchData: function (progress, data, cb) {
      // a little helper to split up our progress bar segment
      var makeProgress = function (progfunc, start, end) {
        return function(x) {
          progfunc(start + (x/100.0)*(end-start));
        };
      };

      debug('STEP: fetchData');
      progress(0);

      var dedupAndCheckOrder = function(records) {

        // First remove all duplicates
        records = _.uniq(records, 'index');

        for(var i = 1; i < records.length; i++)
        {
          if(records[i].index - records[i-1].index != 1)
          {
            return false;
          }
        }
        return records;
      };

      var readAllRecords = function (recordType, request, percentage, callback) {
        resetConnection(true, function(connectErr, obj) {
          if(connectErr) {
            cb(connectErr, obj);
          }else{
            counters.received = 0;
            counters.sent = 0;
            getNumberOfRecords(recordType, function (err, result) {
              if(err) {
                callback(err,null);
              }else{
                debug('Number of',_getName(RECORD_TYPES, recordType),'records:',result);
                var numRecords = result.numRecords;

                if (recordType === RECORD_TYPES.BASAL_PROGRAM.value) {
                  debug('Reading basal schedules');
                  // TODO: read basal schedules when set to 4 instead of just 1
                  // pump does not respond in the same way as with other records :(
                  numRecords = 1;
                }

                getRecords(request, numRecords, percentage, progress, function(err, result){
                  if(err) {
                    debug('Resetting and trying again..');
                    resetConnection(true, function(connectErr, obj) {
                      if(connectErr) {
                        // give up
                        return callback(connectErr, null);
                      }else{
                        counters.received = 0;
                        counters.sent = 0;
                        getRecords(request, numRecords, percentage, progress, function(errRetry, resultRetry){
                          if(errRetry) {
                            //give up
                            return callback(errRetry, null);
                          }
                          else{
                            progress(percentage);
                            var ordered = dedupAndCheckOrder(resultRetry);
                            if (ordered) {
                              callback(null,ordered);
                            }
                            else{
                              callback(new Error('Some data went missing. Please try again.'),null);
                            }
                          }
                        });
                      }
                    });
                  }
                  else {
                    progress(percentage);
                    var ordered = dedupAndCheckOrder(result);
                    if (ordered) {
                      callback(null,ordered);
                    }
                    else{
                      debug('Result:', result);
                      callback(new Error('Some data went missing. Please retry.'),null);
                    }
                  }
                });
              }
            });
          }
        });
      };

      async.series({
        bolusRecords : function(callback){
          readAllRecords(RECORD_TYPES.BOLUS.value, requestBolus(), 10, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        basalRecords: function(callback){
          readAllRecords(RECORD_TYPES.BASAL.value, requestBasal(), 20, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        primeRewindRecords: function(callback){
          readAllRecords(RECORD_TYPES.PRIME_REWIND.value, requestPrimeRewind(), 30, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        suspendResumeRecords: function(callback){
          readAllRecords(RECORD_TYPES.SUSPEND_RESUME.value, requestSuspendResume(), 40, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        wizardRecords: function(callback){
          readAllRecords(RECORD_TYPES.WIZARD.value, requestWizard(), 50, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        alarmRecords: function(callback){
          readAllRecords(RECORD_TYPES.ALARM.value, requestAlarm(), 60, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        /* TODO: Re-enable reading basal programs
        basalProgramRecords: function(callback){
          readAllRecords(RECORD_TYPES.BASAL_PROGRAM.value, requestBasalProgram(), 70, function(err, data) {
            if(err) {
              return callback(err,null);
            }
            else{
              return callback(null,data);
            }
          });
        },
        */
        bgRecords: function(callback){
          if(modelNumber === 'IR1285') {
            readAllRecords(RECORD_TYPES.BLOOD_GLUCOSE.value, requestBG(), 80, function(err, data) {
              if(err) {
                return callback(err,null);
              }
              else{
                return callback(null,data);
              }
            });
          }
          else {
            // TODO: handle CGM calibration records
            return callback(null,[]);
          }
        }
      },
      function(err, results){
        if (err) {
          cb(err, null);
        } else {
          progress(100);
          _.extend(data,results);
          cb(null, data);
        }
      });

      //TODO: read the rest of the data

    },

    processData: function (progress, data, cb) {
      debug('STEP: processData');
      progress(0);
      console.log('Data:', data);

      animasDeviceId = data.settings.modelNumber + '-' + data.settings.serialNumber;
      cfg.builder.setDefaults({ deviceId: animasDeviceId});
      var settings = [];
      settings.time = new Date().toISOString(); //TODO: UTC bootstrapping
      var changes = [];
      var tzoUtil = new TZOUtil(cfg.timezone, settings.time, changes);
      cfg.tzoUtil = tzoUtil;

      var postrecords = [];
      postrecords = buildBolusRecords(data, postrecords);
      // the order here is very important, as filled-in bolus records
      // are used to build the wizard records
      postrecords = buildWizardRecords(data, postrecords);
      postrecords = buildAlarmRecords(data, postrecords);
      postrecords = buildBGRecords(data, postrecords);

      //TODO: fill in settings from pump
      /*
      data.postrecords = buildSettingsRecord(data, postrecords);
      if (!_.isEmpty(data.postrecords)) {
        settings = data.postrecords[0];
      }*/
      simulator = animasSimulator.make({settings: settings});

      var deviceEvent = null;
      for(var d in data.primeRewindRecords) {
        var primedatum = data.primeRewindRecords[d];

        if(primedatum.primeFlags !== 'cannula' && primedatum.primeFlags !== 'tubing') {
          // discarding blank / not primed events
          continue;
        }

        deviceEvent = cfg.builder.makeDeviceEventPrime()
          .with_deviceTime(primedatum.deviceTime)
          .with_primeTarget(primedatum.primeFlags)
          .with_volume(primedatum.deliveredAmount)
          .set('index', primedatum.index);
        cfg.tzoUtil.fillInUTCInfo(deviceEvent, primedatum.jsDate);
        deviceEvent = deviceEvent.done();
        postrecords.push(deviceEvent);

        if(primedatum.primeFlags === 'tubing') {
          // For a successful reservoir change, it looks like either one or two
          // events are generated: a prime event and an optional cannula bolus event,
          // each with a specified delivered amount. As such, we record the prime event
          // as a reservoir change (delivery is not possible on pump without tubing priming).
          var reservoirChangeEvent = cfg.builder.makeDeviceEventReservoirChange()
            .with_deviceTime(primedatum.deviceTime)
            .set('index', primedatum.index);
          cfg.tzoUtil.fillInUTCInfo(reservoirChangeEvent, primedatum.jsDate);
          reservoirChangeEvent = reservoirChangeEvent.done();
          postrecords.push(reservoirChangeEvent);
        }

      }

      var suspend = null;
      var resume = null;
      for(var s in data.suspendResumeRecords) {
        var suspendresumedatum = data.suspendResumeRecords[s];

        suspend = cfg.builder.makeDeviceEventSuspend()
          .with_deviceTime(suspendresumedatum.suspendDeviceTime)
          .with_reason({suspended: 'manual'})
          .set('index', suspendresumedatum.index);
        cfg.tzoUtil.fillInUTCInfo(suspend, suspendresumedatum.suspendJsDate);
        suspend = suspend.done();
        postrecords.push(suspend);

        if(suspendresumedatum.resumeJsDate > suspendresumedatum.suspendJsDate) {
          // as the device needs to be in a suspended state to download data,
          // the last suspend/resume event will not have a valid "resume" timestamp
          resume = cfg.builder.makeDeviceEventResume()
            .with_deviceTime(suspendresumedatum.resumeDeviceTime)
            .with_reason({resumed: 'manual'})
            .set('index', suspendresumedatum.index);
          cfg.tzoUtil.fillInUTCInfo(resume, suspendresumedatum.resumeJsDate);
          postrecords.push(resume);
        }
      }

      for(var i in data.basalRecords) {
          var basaldatum = data.basalRecords[i];

          var basal = null;
          if(basaldatum.basalType === 'temp') {
            basal = cfg.builder.makeTempBasal()
              .with_deviceTime(basaldatum.deviceTime)
              .with_rate(basaldatum.rate)
              .set('index', basaldatum.index);
            cfg.tzoUtil.fillInUTCInfo(basal, basaldatum.jsDate);
          }
          else{
            basal = cfg.builder.makeScheduledBasal()
              //.with_scheduleName(data.basalPrograms.names[data.basalPrograms.enabled_idx].name)
              .with_scheduleName('DEFAULT') //TODO: get basal program name
              .with_rate(basaldatum.rate)
              .with_deviceTime(basaldatum.deviceTime)
              .set('index', basaldatum.index);
            cfg.tzoUtil.fillInUTCInfo(basal, basaldatum.jsDate);
          }

          postrecords.push(basal);
      }

      // sort by log index
      postrecords = _.sortBy(postrecords, function(d) { return d.index; }).reverse();
      // sort by time, including indexed (history) and non-indexed records
      postrecords = _.sortBy(postrecords, function(d) { return d.time; });

      for (var j = 0; j < postrecords.length; ++j) {
        var datum = postrecords[j];
        switch (datum.type) {
          case 'basal':
            simulator.basal(datum);
            break;
          case 'bolus':
            simulator.bolus(datum);
            break;
          case 'deviceEvent':
            if (datum.subType === 'status') {
              if (datum.status === 'suspended') {
                simulator.suspend(datum);
              }
              else if (datum.status === 'resumed') {
                simulator.resume(datum);
              }
              else {
                debug('Unknown deviceEvent status!', datum.status);
              }
            }
            else if (datum.subType === 'alarm') {
              simulator.alarm(datum);
            }
            else if (datum.subType === 'prime' || datum.subType === 'reservoirChange') {
              simulator.changeReservoir(datum);
            }
            else {
              debug('deviceEvent of subType ', datum.subType, ' not passed to simulator!');
            }
            break;
          case 'pumpSettings':
            simulator.pumpSettings(datum);
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

      console.log('getEvents:',simulator.getEvents());
      console.log('getCrudEvents:',simulator.getCrudEvents());


      progress(100);
      data.processData = true;
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      debug('STEP: uploadData');
      progress(0);

      var sessionInfo = {
        deviceTags: ['insulin-pump'],
        deviceManufacturers: ['Animas'],
        deviceModel: data.settings.modelNumber,
        deviceSerialNumber: data.settings.serialNumber,
        deviceId: animasDeviceId,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName: cfg.timezone,
        version: cfg.version
      };

      console.log('sessionInfo:', sessionInfo);

      data.post_records = simulator.getEvents();

      cfg.api.upload.toPlatform(
        data.post_records,
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
      progress(0);
      debug('STEP: disconnect');
      data.disconnect = true;
      progress(100);
      cb(null, data);
  },

    cleanup: function (progress, data, cb) {
      progress(0);
      debug('STEP: cleanup');
      cfg.deviceComms.clearPacketHandler();
      cfg.deviceComms.disconnect(function() {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    }
  };
};
