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

var TZOUtil = require('../TimezoneOffsetUtil');

var debug = require('../bows')('AnimasDriver');

module.exports = function (config) {
  var cfg = _.clone(config);
  debug('animas config: ', cfg);
  var serialDevice = config.deviceComms;
  var animasDeviceId;

  if (config.silent) {
    // debug = _.noop;
  }

  var BOM_BYTE = 0xC0;
  var EOM_BYTE = 0xC1;
  var ADDRESS_CONNECT = 0xFF; //used to establish connection
  var ADDRESS_SET = 0x81; // 11000000b primary devices sets bit 0 (LSB), bit 1-7 is connection address
  var PRIMARY_ADDRESS = 0x01;

  var CMDS = {
    CONNECT: { value: 0x93, name: 'CONNECT'},
    HANDSHAKE: {value: 0xBF, name: 'HANDSHAKE'},
    UA: {value: 0x73, name: 'Unnumbered Acknowledge'},
    RI: {value: 0x5249, name: 'RI message (Read)'},
    ACK: {value: 0x11, name: 'Acknowledge'}
  };

  var RECORD_TYPES = {
    SETTINGS: {value: 15, name: 'MISC. SETTINGS'},
    BOLUS: {value: 21, name: 'BOLUS HISTORY'}
  };

  var getCmdName = function (idx) {
    for (var i in CMDS) {
      if (CMDS[i].value == idx) {
        return CMDS[i].name;
      }
    }
    return 'UNKNOWN COMMAND!';
  };

  var counters = {
    sent : 0,
    received : 0
  };

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

  var buildPacket = function (address, command, payloadLength, payload) {
    var datalen = payloadLength + 6;
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'bbb', BOM_BYTE, address,command);

    ctr += struct.copyBytes(bytes, ctr, checkExceptions(payload), payloadLength);
    // checksum only over address field, control field and payload
    var crc = checkExceptions(crcCalculator.calcCheckBytes(bytes.subarray(1,payloadLength+3), ctr));

    struct.pack(bytes, ctr, 'sb', crc, EOM_BYTE);

    debug('bytes sent:', bytes2hex(bytes));
    return buf;
  };

  var checkExceptions = function(buf) {
    for(var i in buf) {
      var byte = buf[i];
      if(byte == BOM_BYTE || byte == EOM_BYTE || byte == 0x7D) {
        debug('Replacing special character');
        buf[i] = 0x7D;
        buf.splice(i, 0, byte ^ 0x20);
      }
    }
    return buf;
  };

  var setupConnection = function(destinationAddress) {
    var payload = new Uint8Array(9);
    var payloadlength = struct.pack(payload,0,'iib',PRIMARY_ADDRESS,destinationAddress,ADDRESS_SET);
    return {
      packet: buildPacket(
        ADDRESS_CONNECT, CMDS.CONNECT.value, payloadlength, payload
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
        ADDRESS_CONNECT, CMDS.HANDSHAKE.value, 10, [0x01,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0x02,iter]
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
    if(counters.sent == 7) // counter is only 3 bits
      counters.sent = 0;
  };

  var incrementReceivedCounter = function() {
    counters.received += 1;
    if(counters.received == 7) // counter is only 3 bits
      counters.received = 0;
  };

  var readDataPages = function (rectype, offset, numRecords) {

    var payload = new Uint8Array(8);
    var payloadlength = struct.pack(payload,0,'Ssss',CMDS.RI.value,rectype,offset,numRecords);

    return {
      packet: buildPacket(
        ADDRESS_SET,
        getCounters(),
        payloadlength,
        payload
      ),
      parser: function (packet) {
        return packet;
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

    // calc the checksum
    packet.crc = struct.extractShort(bytes, bytes.length - 3);
    var crc = crcCalculator.calcCheckBytes(bytes.subarray(1,bytes.length-3));
    if (crc != packet.crc) {
      // if the crc is bad, we should discard the whole packet
      debug('Invalid CRC');
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
    }else{
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

    debug('Raw packet: ', bytes2hex(buffer.bytes()));

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
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      if (serialDevice.hasAvailablePacket()) {
        var pkt = serialDevice.nextPacket();
        debug('Received packet: ', pkt);
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        // only attempt to parse the payload if it worked
        if (pkt.payload) {
          pkt.parsed_payload = commandpacket.parser(pkt);
        }
        callback(null, pkt);
      }
    }, 10);
  };

  var sendAck = function (obj,cb) {
    var cmd = {
      packet: buildPacket(
        ADDRESS_SET, CMDS.ACK.value | (counters.received << 5), 0, []
      ),
      parser: function (packet) {
        var data = {
          nextPacket : struct.extractByte(packet.payload, 0)
        };
        return data;
      }
    };

    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        cb(null, result);
      }
    });
  };

  var animasCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      listenForPacket(3000, commandpacket, callback);
    });
  };

  var animasCommandResponseAck = function (cmd, cb) {
    // This is for Information packets, where one ACK is received after the command is sent,
    // and an ACK is sent in response. When the payload is received, another ACK is sent.
    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        cb(err, null);
      } else {
        if(result.ack) {
          incrementSentCounter();
          sendAck(true, function (err, result){
            if(result.payload) {
              incrementReceivedCounter();
              var payload = result.payload;
              sendAck(true, function (err, result){
                cb(null,payload);
              });
            }
          });
        }
      }
    });
  };

  var discoverDevice = function(obj,cb) {
    debug('discovering animas device');

    var i = 0;
    var handshakeInterval = setInterval(function() {
      debug('Polling slot ',i);
      var cmd = handshake(i);
      i++;
      if(i == 16) {
        clearInterval(handshakeInterval);
        debug('Did not find device.');
        cb(null,null);
      }

      animasCommandResponse(cmd, function (err, result) {
        if (err) {
          cb(null, null);
        } else {
          clearInterval(handshakeInterval);
          cb(null, result);
        }
      });

    }, 200);

  };

  var getConnection = function(obj, cb) {
    debug('connecting to animas');
    var i = 0;
    var connectInterval = setInterval(function() {
      debug('Attempt ',i);
      var cmd = setupConnection(obj.destinationAddress);
      i++;
      if(i == 8) {
        clearInterval(connectInterval);
        debug('Could not connect to device.');
        cb(null,null);
      }

      animasCommandResponse(cmd, function (err, result) {
        if (err) {
          cb(err, null);
        } else {
          clearInterval(connectInterval);
          cb(null, result);
        }
      });
    }, 200);
  };

  var readMiscSettings = function(cb) {
      var cmd = readDataPages(RECORD_TYPES.SETTINGS.value,0,1);
      animasCommandResponseAck(cmd, function (err, result) {
        if (err) {
          cb(err, null);
        } else {
          var data = {
            insulinSensitivity : struct.extractShort(result,10),
            bgTarget: struct.extractShort(result,8)
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
        var data = {
          numRecords : struct.extractShort(result,0),
          recordSize: struct.extractShort(result,2)
        };
        cb(null,data);
      }
    });
  };

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

        discoverDevice(true, function(discoverErr, obj) {
          if(discoverErr) {
            cb(discoverErr, obj);
          }else{

            getConnection(true, function(connectErr, obj) {
              if(connectErr) {
                cb(connectErr, obj);
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
                  cb(null,null);
                }
              }
            });
          }
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('STEP: getConfigInfo');

      readMiscSettings(function (err, result) {
        if(err) {
          cb(err,null);
        }else{
          progress(100);
          data.settings = result;
          data.getConfigInfo = true;
          cb(null, data);
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

      //TODO: fetchData
      getNumberOfRecords(RECORD_TYPES.BOLUS.value, function (err, result) {
        if(err) {
          cb(err,null);
        }else{
          debug('Number of records:',result);
          cb(null, data);
        }
      });


      progress(100);
      //cb(null, data);

    },

    processData: function (progress, data, cb) {
      debug('STEP: processData');
      progress(0);

      //TODO: processData

      progress(100);
      data.processData = true;
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      debug('STEP: uploadData');
      progress(0);

      //TODO: uploadData

      progress(100);
      return cb(null, data);

    },

    disconnect: function (progress, data, cb) {
      debug('STEP: disconnect');
      progress(100);
      data.disconnect = true;
      cb(null, data);
  },

    cleanup: function (progress, data, cb) {
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
