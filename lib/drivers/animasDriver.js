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
  var ADDRESS_CONNECT = 0xFF; //used to establish 7-bit conenction address

  var CMDS = {
    NULL: { value: 0, name: 'NULL' },
    ACK: { value: 1, name: 'ACK' },
    NAK: { value: 2, name: 'NAK' },
    INVALID_COMMAND: { value: 3, name: 'Invalid Command' },
    CONNECT: { value: 0x93, name: 'CONNECT'},
    HANDSHAKE: {value: 0xBF, name: 'HANDSHAKE'}
  };

  var getCmdName = function (idx) {
    for (var i in CMDS) {
      if (CMDS[i].value == idx) {
        return CMDS[i].name;
      }
    }
    return 'UNKNOWN COMMAND!';
  };

  var firmwareHeader = null;

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

  var setupConnection = function() {
    return {
      packet: buildPacket(
        ADDRESS_CONNECT, CMDS.CONNECT.value, 9, [0x01,0x00,0x00,0x00,0x02,0x00,0x00,0x00,0x01]
      ),
      parser: function (packet) {
        var data = parsePayload(packet);
        return data;
      }
    };
  };

  var handshake = function(iter) {
    return {
      packet: buildPacket(
        //ADDRESS_CONNECT, CMDS.HANDSHAKE.value, 10, [0x01,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0x03,iter]
        ADDRESS_CONNECT, CMDS.HANDSHAKE.value, 10, [0x01,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0x02,0x00]
      ),
      parser: function (packet) {
        console.log('Packet received: ',packet);
        var data = parsePayload(packet);
        return data;
      }
    };
  };

  var readFirmwareHeader = function () {
    return {
      packet: buildPacket(
        //TODO: CMDS.READ_FIRMWARE_HEADER.value, 0, null

      ),
      parser: function (packet) {
        //TODO: parse out firmware header
        //firmwareHeader = data;
        //return data;
      }
    };
  };

  var ping = function () {
    return {
      packet: buildPacket(
        //TODO: CMDS.PING.value, 0, null
      ),
      parser: function (packet) {
        debug('pong!');
        debug(packet);
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
    packet.packet_len = bytes.length-7;
    packet.payload = new Uint8Array(packet.packet_len);
    for (var i = 0; i < bytes.length - 7; ++i) {
      packet.payload[i] = bytes[i + 3];
    }

    packet.valid = true;
    return packet;
  };

  var parsePayload = function (packet) {
    console.log('Packet:', packet);

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
        if (pkt.command != CMDS.ACK.value) {
          callback('Bad result ' + pkt.command + ' (' +
                   getCmdName(pkt.command) + ') from data packet', pkt);
        } else {
          // only attempt to parse the payload if it worked
          if (pkt.payload) {
            pkt.parsed_payload = commandpacket.parser(pkt);
          }
          callback(null, pkt);
        }
      }
    }, 5);
  };

  var animasCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(500, commandpacket, callback);
    });
  };

  var getConnection = function(obj, cb) {

    debug('handshaking with animas');

    var waitTimer = setTimeout(function () {

      var i = 0;
      var handshakeInterval = setInterval(function() {
        console.log('Handshake ',i);
        var cmd = handshake(i);
        animasCommandResponse(cmd, function (err, result) {
          if (err) {
            cb(null, null);
          } else {
            console.log(result);
            clearInterval(handshakeInterval);
            cb(null, result);
          }
        });

        i++;
        if(i == 10) {
          clearInterval(handshakeInterval);
        }
      }, 10);

    }, 1000);
    /*
    debug('connecting to animas');
    var cmd = setupConnection();
    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        debug('Failure trying to talk to animas.');
        debug(err);
        debug(result);
        cb(null, null);
      } else {
        cb(null, obj);
      }
    });*/
  };

  var getFirmwareHeader = function (obj, cb) {
    debug('looking for animas');
    var cmd = readFirmwareHeader();
    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        debug('Failure trying to talk to animas.');
        debug(err);
        debug(result);
        cb(null, null);
      } else {
        cb(null, obj);
      }
    });
  };

  function do_ping(cb) {
    var cmd = ping();
    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        debug('Failure trying to talk to animas.');
        debug(err);
        debug(result);
        cb(null, null);
      } else {
        cb(null, null);
      }
    });
  }

  // this is the probe function passed to connect
  function probe(cb) {
    cb();
  }


  return {
    // using the default detect for this driver
    // detect: function(cb) {
    // },

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
          return cb(err);
        }

        getConnection(true, function(connectErr, obj) {
          if(connectErr) {
            cb(connectErr, obj);
          }else{

            getFirmwareHeader(true, function(firmwareErr, obj) {
              if (firmwareErr) {
                cb(firmwareErr, obj);
              } else {

                    do_ping(function (err, result) {
                      // we're talking so tell the serial device to record this port
                      cfg.deviceComms.recordPort(data.deviceInfo.driverId);
                      progress(100);
                      data.connect = true;
                      // TODO:
                      //data.firmwareHeader = firmwareHeader;
                      //data.partitionInfo = partitionInfo;
                      //data.model = firmwareHeader.attrs.ProductId;
                      cb(null, data);
                    });

              }
            });
          }
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('STEP: getConfigInfo');

      //TODO: fetch manufacturing data
      progress(100);
      data.getConfigInfo = true;
      cb(null, data);

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

      progress(100);
      cb(null, data);

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
