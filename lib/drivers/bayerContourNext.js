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

  var buildReadCmd = function(recnum) {
    return {
        packet: buildPacket(ASCII_CONTROL.ACK, 1),
        parser: function(result){
          var tostr = _.map(result.bytes,
                            function(e){
                              return String.fromCharCode(e);
                            }).join('');
          result.payload = tostr;
          return tostr;
        }
    };
  };

  var buildAckPacket = function() {
    return buildPacket(ASCII_CONTROL.ACK, 1);
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
    return {
      //packet: buildHeaderPacket(),
      packet: buildAckPacket(),
      parser: function (result) {
        //TODO: este parser deberia sacar los primeros bytes que contienen ABC
        //return struct.unpack(result.payload, 0, '...9Z8Z', ['version', 'creationDate']);
        var tostr = _.map(result.bytes,
                          function(e){
                            return String.fromCharCode(e);
                          }).join('');
        result.payload = tostr;
        return tostr;
      },
    };
  };

  var parseHeader = function (s){
    var data = s.split('\n').filter(function(e){ return e !== ''});
    var header = data.shift();
    var patient = data.shift();
    var pString = header.split('|');
    var pInfo = pString[4].split('^');
    var records = data;

    var devInfo = {
      model: pInfo[0],
      serialNumber: pInfo[2],
      nrecs: pString[6],
      rawrecords: records
    };

    return devInfo;
  };


  var parseDataRecord = function (str){
    var arrayData = str.split('');
    var reg = arrayData[0].trim();
    var result = reg.match(/^.*\d+R\|(\d+).*Glucose\|(\d+)\|.*(\d{12})$/).slice(1,4);
    result.push(arrayData[1]);
    return result;
  };

  var getOneRecord = function (record, cb) {
    var r = parseDataRecord(record);
    var robj = {};
    if (!r) {
        debug('Failure trying to read record', record);
        debug(err);
        debug(result);
        cb(err, null);
    } else {
        //TODO: Fixme
        robj.timestamp = parseInt(r[2]);
        robj.glucose = parseInt(r[1]);
        robj.nrec = parseInt(r[0]);
        cb(null, robj);
    }
  };

  var bcnCommandResponse = function (commandpacket, callback) {

    hidDevice.send(commandpacket.packet, function () {
        // Just receive what we asked for
        receivePacket(15000, commandpacket.parser, function(err, packet) {
            debug('final del receivePacket', packet);
            var rawtext = '';
            while(hidDevice.hasAvailablePacket()){
                var pkt = hidDevice.nextPacket();
                pkt.parsed_payload = commandpacket.parser(pkt);
                //callback(null, pkt);
                rawtext += pkt.parsed_payload;
            }

            if (err !== 'TIMEOUT') {
              callback(err, rawtext);
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
          debug('en receivePacket');

          // verify if we have an EOT
          var r = new Uint8Array(raw);
          debug('r=', r);
          var startIndex = 0;
          var hasETX = _.indexOf(r, ETX, startIndex);
          var hasETB = _.indexOf(r, ETB, startIndex);

          if(hasETB !== -1){
              // send a new ACK
              var cmd = buildAckPacket();
              hidDevice.send(cmd, function () {
                  debug('New ACK SENT');
              });

          }else if(hasETX !== -1){
              debug('hiDevice.receive encontrado EOT');
              //var pkt = hidDevice.nextPacket();
              clearTimeout(abortTimer);
              clearInterval(listenTimer);

              callback(null, '');
          }
        });
      }, 200);
  };

  var getDeviceInfo = function (obj, cb) {
      debug('DEBUG: on getDeviceInfo');
      //cb();
      var cmd = buildHeaderCmd();
      bcnCommandResponse(cmd, function (err, datatxt) {
          if (err) {
              debug('Failure trying to talk to device.');
              debug(err);
              debug(datatxt);
              cb(null, null);
          } else {
              obj.header = datatxt;
              _.assign(obj, parseHeader(datatxt));
              cb(null, obj);
          }
      });
  };

  //TODO: Fixme
  var processReadings = function(readings) {
    _.each(readings, function(reading, index) {
      readings[index].displayTime = sundial.formatDeviceTime(new Date(reading.timestamp).toISOString());
      readings[index].displayUtc = sundial.applyTimezone(readings[index].displayTime, cfg.timezone).toISOString();
      readings[index].displayOffset = sundial.getOffsetFromZone(readings[index].displayUtc, cfg.timezone);
    });
  };

  //TODO: fixme
  var prepBGData = function (progress, data) {
    //build missing data.id
    data.id = data.model + '-' + data.serialNumber;
    cfg.builder.setDefaults({ deviceId: data.id});
    var dataToPost = [];
    if (data.bgmReadings.length > 0) {
      for (var i = 0; i < data.bgmReadings.length; ++i) {
        var datum = data.bgmReadings[i];
        var smbg = cfg.builder.makeSMBG()
          .with_value(datum.glucose)
          .with_deviceTime(datum.displayTime)
          .with_timezoneOffset(datum.displayOffset)
          .with_time(datum.displayUtc)
          .with_units('mg/dL')
          .done();
        dataToPost.push(smbg);
      }
    }else{
      debug('Device has not records to upload');
    }

    return dataToPost;
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

      function getOneRecordWithProgress(recnum, cb) {
        var rec = data.rawrecords.shift();
        progress(100.0 * rec.nrec / data.nrecs);
        setTimeout(function() {
          getOneRecord(rec, cb);
        }, 20);
      }

      async.timesSeries(data.nrecs, getOneRecordWithProgress, function(err, result) {
        if (err) {
          debug('fetchData failed');
          debug(err);
          debug(result);
        } else {
          debug('fetchData', result);
        }
        data.fetchData = true;
        data.bgmReadings = result;
        progress(100);
        cb(err, data);
      });
    },

    processData: function (progress, data, cb) {
        progress(0);
        data.bg_data = processReadings(data.bgmReadings);
        data.post_records = prepBGData(progress, data);
        debug(data.post_records);
        var ids = {};
        for (var i = 0; i < data.post_records.length; ++i) {
            var id = data.post_records[i].time + '|' + data.post_records[i].deviceId;
            if (ids[id]) {
                debug('duplicate! %s @ %d == %d', id, i, ids[id] - 1);
                debug(data.post_records[ids[id] - 1]);
                debug(data.post_records[i]);
            } else {
                ids[id] = i + 1;
            }
        }
        progress(100);
        data.processData = true;
        cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Bayer'],
        deviceModel: 'BayerContour Next',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        tzName : cfg.timezone,
        version: cfg.version
      };

      debug('session Info : ' + sessionInfo);

      /*cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
        if (err) {
          debug(err);
          debug(result);
          progress(100);
          return cb(err, data);
        } else {
          progress(100);
          return cb(null, data);
        }
      });*/

      data.cleanup = true;
      cb(null, data);
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
