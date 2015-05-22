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

/**
 * IOET's code start here
 * packet frame format <STX> FN text <ETX> C1 C2 <CR> <LF>
 * */
var _ = require('lodash');
var async = require('async');
var moment = require('moment-timezone');
var sundial = require('sundial');
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../bows')('BCNextDriver') : debug;


module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;

  var STX = 0x02;
  var ETB = 0x17;
  var ETX = 0x03;
  var EOT = 0x04;

  /*
   * TODO This info should be collected in the initial phase cause we can't assert if
   *      it is the same for all contour devices
   * */
  var REPORT_BYTES = {
    reportID: 0x41, // A
    checksum: 0x00,
    hostID  : 0x42, // B
    deviceID: 0x43  // C
  };

  /* end */

  var ASCII_CONTROL = {
    ACK : 0x06,
    NAK : 0x15,
    ENQ : 0x05
  };

  var probe = function(cb){
    debug('attempting probe of Bayer Contour Next');
    //cb();
  };

  var bcnPacketHandler = function (buffer) {
    // we need to get the REPORT_BYTES here for the first communication
    // time if they are not set
    var discardCount = 3;
    //while (buffer.len() > discardCount && buffer.get(0) != STX) {
    //  ++discardCount;
    //}

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
      buffer.discard(packet.packet_len + 1);  // 1 is for packet_length
    }

    if (packet.valid) {
      return packet;
    } else {
      return null;
    }
  };

  var buildPacket = function (command, cmdlength) {
    var datalen = cmdlength + 4; // We need just 5 bytes for now
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    var ctr = struct.pack(bytes, 0, 'bbb', REPORT_BYTES.reportID,
                          REPORT_BYTES.hostID, REPORT_BYTES.deviceID,
                          STX, command);
    if (cmdlength) {
      ctr += struct.pack(bytes, 3, 'bb', cmdlength, command);
    }
    return buf;
  };

  var buildReadRecord = function(recnum) {
    return buildPacket(ASCII_CONTROL.ACK, 0, null);
  };

  var buildAckPacket = function() {
    return buildPacket(ASCII_CONTROL.ACK, 0);
  };

  var buildHeaderPacket = function() {
    var cmd = 0x3a;  // just anything 'x'
    return buildPacket(cmd, 1);
  };

  var extractPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      payload: null
    };

    //if (bytes[0] != STX) {
    //  return packet;
    //}

    var plen = bytes.length;
    var packet_len = struct.extractByte(bytes, 0);
    if (packet_len > plen) {
      return packet;  // we're not done yet
    }

    //discard the length byte from the begining
    var tmpbuff = new ArrayBuffer(packet_len);
    struct.copyBytes(tmpbuff, 0, bytes, packet_len, 1);
    packet.bytes = tmpbuff;

    // we now have enough length for a complete packet, so calc the CRC
    packet.packet_len = packet_len;
    packet.valid = true;

    return packet;
  };


  var buildHeaderCmd = function() {
    var headerPackets = [];
    return {
      packet: buildHeaderPacket(),
      parser: function (result) {
        //TODO: este parser deberia sacar los primeros bytes que contienen ABC
        //return struct.unpack(result.payload, 0, '...9Z8Z', ['version', 'creationDate']);
        var tostr = _.map(result.bytes,
                          function(e){
                            return String.fromCharCode(e)
        }).join('');
        result.payload = tostr;
        headerPackets.push(result);
        return tostr;
      },
      getHeaderPackets: function(){return headerPackets;}
    };
  };

  var bcnCommandResponse = function (commandpacket, callback) {

    hidDevice.send(commandpacket.packet, function () {
        // Just receive what we asked for
        receivePacket(5000, commandpacket.parser, function(err, packet) {
            debug('final del receivePacket', packet);
            var dump = "";
            while(hidDevice.hasAvailablePacket()){
                var pkt = hidDevice.nextPacket();
                pkt.parsed_payload = commandpacket.parser(pkt);
                //callback(null, pkt);
                dump += pkt.parsed_payload;
            }
            debug('dump del receivePacket', dump);

            if (err !== 'TIMEOUT') {
              callback(err, dump);
            }else{
              debug('receivePacket timed out');
            }
        });
    });
  };

  var receivePacket = function (timeout, parser, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      hidDevice.receive(function(raw) {
          debug('en receivePacket', raw);

          //verify if we have an ETB
          var r = struct.unpack(new Uint8Array(raw), 4, 'b', ['ENQ']);
          if(r.ENQ === ASCII_CONTROL.ENQ){
              debug('hiDevice.receive encontrado ENQ');
              //var pkt = hidDevice.nextPacket();
              clearTimeout(abortTimer);
              clearInterval(listenTimer);

              //if(hidDevice.hasAvailablePacket()){
              //  var pkt = hidDevice.nextPacket();
              //  pkt.parsed_payload = parser(pkt);
              //  callback(null, pkt);
              //}
              callback(null, '');
          }
        });
      }, 200);
  };

  var getAllRecords = function (cb) {
    var cmd = buildReadRecord();

    bcnCommandResponse(cmd, function (err, packet) {
      if (err) {
        debug('Failure trying to read records');
        debug(err);
        debug(packet);
        cb(err, null);
      } else {
        console.log('getAllRecords:', packet);
        cb(null, packet.parsed_payload);
      }
    });
  };

  var getDeviceInfo = function (obj, cb) {
      debug('DEBUG: on getDeviceInfo');
      //cb();
      var cmd = buildHeaderCmd();
      bcnCommandResponse(cmd, function (err, result) {
          if (err) {
              debug('Failure trying to talk to device.');
              debug(err);
              debug(result);
              cb(null, null);
          } else {
              _.assign(obj, {resultado: result.parsed_payload});
              cb(null, obj);
          }
      });
  };

  return {
    detect: function(deviceInfo, cb){
      debug('mi propio detect ', arguments);
      cb(null, deviceInfo);
    },
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      progress(100);
      debug('in connect!');

      cfg.deviceComms.connect(data.deviceInfo, bcnPacketHandler, probe, function(err) {
        if (err) {
          return cb(err);
        }
        cb(null, data);

      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('in getConfigInfo', data);

      getDeviceInfo({}, function (err, result) {
          progress(100);
          data.connect = true;
          _.assign(data, result);

          cb(null, data);
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData', data);

      //function getAllRecordsWithProgress(recnum, cb) {
      //  progress(100.0 * recnum / data.nrecs);
      //  setTimeout(function() {
      //    getAllRecords(recnum, cb);
      //  }, 20);
      //}

      ////TODO: esto realmente se deberia ir de aqui
      //data.nrecs = 1;
      //async.timesSeries(data.nrecs, getAllRecordsWithProgress, function(err, result) {
      //  if (err) {
      //    debug('fetchData failed');
      //    debug(err);
      //    debug(result);
      //  } else {
      //    debug('fetchData', result);
      //  }
      //  data.fetchData = true;
      //  data.bgmReadings = result;
      //  progress(100);
      //  cb(err, data);
      //});

    },

    processData: function (progress, data, cb) {

    },

    uploadData: function (progress, data, cb) {

    },

    disconnect: function (progress, data, cb) {
      debug('en disconnect');
      progress(100);
      data.disconnect = true;
      cb(null, data);
    },

    cleanup: function (progress, data, cb) {
      debug('en cleanup');
      cfg.deviceComms.disconnect(data, function() {
        progress(100);
        data.cleanup = true;
        cb(null, data);
      });
    },

    testDriver: function(config) {

    }
  };
};
