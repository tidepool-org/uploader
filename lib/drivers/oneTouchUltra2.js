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
 * pvalarezo@ioet.com
 */

var _ = require('lodash');
//Asyncronous javscript
var async = require('async');
//TidePool lib for ISO date handling
var sundial = require('sundial');
//TidePool struct lib
var struct = require('../struct.js')();

module.exports = function (config) {
  var cfg = _.clone(config);
  cfg.deviceData = null;
  var serialDevice = config.deviceComms;

  //BYTE START DEFINITION HEX
  var DM = '\x11\x0d';
  var DMDateTime = DM.concat('\x44\x4d\x46');
  var DMSoftVersion = DM.concat('\x44\x4d\x3f');
  var DMSerialNumber= DM.concat('\x44\x4d\x40');
  var DMUpload = DM.concat('\x44\x4d\x50');
  var DMGlucoseUnits = DM.concat('\x44\x4d\x53\x55\x3f');
  var DMTimeFormat = DM.concat('\x44\x4d\x53\x54\x3f');
  var CR = 0x0D;
  var LF = 0x0A;

  var buildPacket = function (bytes) {
    var packet = {
      bytes: bytes,
      valid: false,
      packet_len: 0,
      lcb: 0,
      payload: null,
      crc: 0
    };

    var packet_len = bytes.byteLength;
    packet.packet_len = packet_len;
    packet.valid = true;
    return packet;
  };

  var otu2MessageHandler = function (buffer) {

    if (buffer.len() < 1) {
      return false;
    }

    console.log('buffer.bytes() ', buffer.bytes());

    // there's enough there to try, anyway
    var packet = buildPacket(buffer.bytes());
    if (packet.packet_len !== 0) {
      // remove the now-processed packet
      buffer.discard(packet.packet_len);
    }

    if (packet.valid) {
      console.log('found packet: ', packet, ' len:', packet.packet_len, ' valid:', packet.valid);
      return packet;
    } else {
      return null;
    }
  };

  var otu2ErrorHandler = function(info) {
    // we don't care too much for timeout errors
    if(info.error && info.error!=='timeout'){
      console.log('DEBUG OTU2ERROR:', info);
    }
    if (info.connectionId && info.error) {
      if (info.error == 'timeout') {
        return -9; // TODO check this
      }
    }
  };

  var byteConcat = function (a, b){
      var aLength = a.length,
      result = new Uint8Array(aLength + b.length);

      result.set(a);
      result.set(b, aLength);

      return result;
  };

  var listenForPacket = function (timeout, callback) {
    console.log('DEBUG listenForPacket');
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      console.log('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      var wholebytes = new Uint8Array([]), pkt;

      while(serialDevice.hasAvailablePacket()) {
        pkt = serialDevice.nextPacket();
        wholebytes = byteConcat(wholebytes, pkt.bytes);
      }

      pkt = buildPacket(wholebytes);
      var tostr = String.fromCharCode.apply(String, pkt.bytes);
      console.log('DEBUG OTU2 listenForPacket:', pkt, tostr);
      clearTimeout(abortTimer);
      clearInterval(listenTimer);

      callback(null, pkt);
    }, 400);     // spin on this one not so quickly
  };

  var probe = function(cb){
    console.log('attempting probe of oneTouch Ultra2 - don\'t probe anything');
    //otu2CommandResponse(DM, cb);
    cb();
  };

  var otu2CommandResponse = function (command, callback) {
    var cmd = struct.packString(command);
    serialDevice.writeSerial(cmd, function () {
      listenForPacket(3600, function(err, pkt) {
        if (err === 'TIMEOUT') {
        } else {
          callback(err, pkt);
        }
      });

    });

  };

  var getSomeInfo = function (obj, cb) {
      console.log('DEBUG: on getSomeInfo');
      cb();
  };

  var prepBGData = function (progress, data) {
    cfg.builder.setDefaults({ deviceId: data.id });
    var dataToPost = [];
    // Don't erase yet. We need to get the endIndex for the checksum
    // var bytes = data.bytes;
    // var lines = [];

    // // split up into lines by searching for '\r\n'
    // var startIndex = 0;
    // var endIndex = _.indexOf(bytes, CR, startIndex + 1);

    // var startLine = startIndex;
    // while (startLine < endIndex) {
    //   var endLine = _.indexOf(bytes, CR, startLine);
    //   if (endLine === -1) {
    //     endLine = endIndex - 1;
    //   }
    //   if (bytes[endLine + 1] != LF) {
    //     // something borked, we should discard the packet
    //     console.log('hmmm...bad packet with CR but not LF', bytes);
    //     packet.packet_len = endLine;
    //     return packet;
    //   }

    //   var line = String.fromCharCode.apply(String, bytes.buffer.slice(startLine, endLine));
    //   lines.push(line);
    //   startLine = endLine + 2;
    // }

    //This is converting to a string the data bytes array
    var lines = String.fromCharCode.apply(null, data.bytes);

    // extract header
    var hpattern = /^P (\d{3}),"(\w{9})","(\w+\/\w+).*" (\w+)/;

    var toMatch = lines.match(hpattern);
    var nrecords = toMatch[1],
        serialno = toMatch[2],
        oum = toMatch[3],
        checksum = toMatch[4],
        calcchks = 0;

    // At this point we have the nreords, serial, oum, chcksum and clcchks

    // Need another way to check witout endline.
    // verify header checksum 26 total bytes static
    // calcchks = _.reduce(bytes.slice(0, 26), function(s1, e){ return s1 + e;}, 0);
    // if(calcchks !== parseInt()){
    //     console.log('hmmm...bad checksum', calcchks, checksum);
    //     packet = endLine;
    //     return packet;
    // }

    //We are not getting lines yet

    // get data from lines
    // var dpattern = /^P "(\w+)","(.+)","(.+)","(\d+)","(\w)","(\d+)", (\d{2}) ([[:xdigit:]]+)/;
    // _.forEach(toMatch.slice(1), function(l){
    //     var ms = l.match(dpattern),
    //         dow = ms[1], // day of week
    //         dor = ms[2], // date of reading
    //         tor = ms[3], // time of reading
    //         rf  = ms[4], // result format
    //         alv = ms[5], // alpha value
    //         umc = ms[6]; // numeric value for user meal comment

        // We need another way to build smbg
        // var smbg = cfg.builder.makeSMBG()
        //               .with_value(datum.glucose)
        //               .with_deviceTime(datum.displayTime)
        //               .with_timezoneOffset(TZOFFSET / 60)
        //               .with_time(datum.displayUtc)
        //               .with_units('mg/dL')
        //               .done();
        dataToPost.push(smbg);
    // });
    return dataToPost;
  };

  return {
    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      console.log('in connect!');

      var handlers = {
        packetHandler: otu2MessageHandler,
        errorHandler: otu2ErrorHandler
      };

      //PV add some timeout - maybe there is a better place to set this
      //on manifest is not working
      data.deviceInfo.sendTimeout = 5000;
      data.deviceInfo.receiveTimeout = 5000;

      cfg.deviceComms.connect(data.deviceInfo, handlers, probe, function(err) {
        if (err) {
          return cb(err);
        }

        getSomeInfo({}, function (err, result) {
          progress(100);
          data.connect = true;
          _.assign(data, result);
          cb(null, data);
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      // we don't do too much here
      console.log('in getConfigInfo', data);
      progress(100);
      cb(null, data);
    },

    fetchData: function (progress, data, callback) {
      console.log('in fetchData');

      console.log('what is data: ', data);

      var cmd = DMUpload;

      otu2CommandResponse(cmd, function(err, result){
          if (err) {
              console.log('Failure trying to talk to device.');
              console.log(err);
              console.log(result);
              callback(err, null);
          } else {
              //PV grow up the results
              console.log('fetchData otu2CommandResponse:', result);
              var obj = {};
              _.assign(obj, result);
              callback(null, obj);
          }
      });
    },

    processData: function (progress, data, cb) {
      progress(0);
      progress(100);
      data.post_records = prepBGData(progress, data);
      data.processData = true;
      //console.log('processData:', data);
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      //var sessionInfo = {
      //  deviceTags: ['bgm'],
      //  deviceManufacturers: ['Abbott'],
      //  deviceModel: 'FreeStyle Precision Xtra',
      //  deviceSerialNumber: data.serialNumber,
      //  deviceId: data.id,
      //  start: sundial.utcDateString(),
      //  tzName : cfg.timezone,
      //  version: cfg.version
      //};

      //cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
      //  if (err) {
      //    console.log(err);
      //    console.log(result);
      //    progress(100);
      //    return cb(err, data);
      //  } else {
      //    progress(100);
      //    return cb(null, data);
      //  }
      //});

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
      cfg.deviceComms.clearErrorHandler();
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
