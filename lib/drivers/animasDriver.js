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

  var CMDS = {
    NULL: { value: 0, name: 'NULL' },
    ACK: { value: 1, name: 'ACK' },
    NAK: { value: 2, name: 'NAK' },
    INVALID_COMMAND: { value: 3, name: 'Invalid Command' }
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
    var address =
    var ctr = struct.pack(bytes, 0, 'bb', BOM_BYTE,
                          datalen, command);
    ctr += struct.copyBytes(bytes, ctr, payload, payloadLength);
    var crc = crcCalculator.calcCRC_D(bytes, ctr);
    struct.pack(bytes, ctr, 's', crc);
    return buf;
  };


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
        debug('pong!');
        debug(packet);
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

    var plen = bytes.length;
    var packet_len = struct.extractShort(bytes, 1);
    // minimum packet len is 6
    if (packet_len > plen) {
      return packet;  // we're not done yet
    }

    // we now have enough length for a complete packet, so calc the CRC
    packet.packet_len = packet_len;
    packet.crc = struct.extractShort(bytes, packet_len - 2);
    var crc = crcCalculator.calcCRC_D(bytes, packet_len - 2);
    if (crc != packet.crc) {
      // if the crc is bad, we should discard the whole packet
      // (packet_len is nonzero)
      return packet;
    }

    // command is the fourth byte, packet is remainder of data
    packet.command = bytes[3];
    packet.payload = new Uint8Array(packet_len - 6);
    for (var i = 0; i < packet_len - 6; ++i) {
      packet.payload[i] = bytes[i + 4];
    }

    packet.valid = true;
    return packet;
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
    }, 20);     // spin on this one quickly
  };

  var animasCommandResponse = function (commandpacket, callback) {
    serialDevice.writeSerial(commandpacket.packet, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(1000, commandpacket, callback);
    });
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
    var cmd = ping();
    animasCommandResponse(cmd, function (err, result) {
      if (err) {
        debug('Failure trying to talk to animas.');
        debug(err);
        debug(result);
      }
      cb(err, result);
    });
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
        getFirmwareHeader(true, function(firmwareErr, obj) {
          if (firmwareErr) {
            cb(firmwareErr, obj);
          } else {

                do_ping(function (err, result) {
                  // we're talking so tell the serial device to record this port
                  cfg.deviceComms.recordPort(data.deviceInfo.driverId);
                  progress(100);
                  data.connect = true;
                  data.firmwareHeader = firmwareHeader;
                  data.partitionInfo = partitionInfo;
                  data.model = firmwareHeader.attrs.ProductId;
                  cb(null, data);
                });

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
      cb(err, data);

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
