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
 *
 * The header is something like:
 * P 003,"GMF600DCY","MG/DL " 05A6
 *
 * The registers looks like:
 * P "SAT","03/21/15","16:45:24   ","  081 ","N","03", 00 09B6
 * P "SAT","03/21/15","16:42:11   ","  105 ","B","02", 00 099F
 * P "SAT","03/21/15","16:39:46   ","  176 ","N","02", 00 09C1
 *
 */

var _ = require('lodash');
var async = require('async');
var sundial = require('sundial');
var struct = require('../../struct.js')();
var TZOUtil = require('../../TimezoneOffsetUtil');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('../../bows')('Ultra2Driver') : debug;

module.exports = function (config) {
  var cfg = _.clone(config);
  cfg.deviceData = null;
  var serialDevice = config.deviceComms;
  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  //BYTE START DEFINITION HEX
  var DM = '\x11\x0d';
  var DMDateTime = DM.concat('DMF'); // hex code '\x44\x4d\x46'
  var DMSoftVersion = DM.concat('DM?'); // hex code '\x44\x4d\x3f'
  var DMSerialNumber= DM.concat('DM@'); // hex code '\x44\x4d\x40'
  var DMUpload = DM.concat('DMP'); // hex code '\x44\x4d\x50';
  var DMGlucoseUnits = DM.concat('DMSU?'); // hex code '\x44\x4d\x53\x55\x3f'
  var DMTimeFormat = DM.concat('DMST?'); // hex code '\x44\x4d\x53\x54\x3f'
  var CR = 0x0D;
  var LF = 0x0A;

  function buildDateTime(date, time) {
    var fmt = 'MM/DD/YY HH:mm:ss';
    var ddate = date + ' ' + time;
    return sundial.parseFromFormat(ddate, fmt);
  }

  var buildPacket = function (bytes) {
    var packet = {
      id: 'OneTouchUltra2 ', // wait for the serial number later
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
    // there's enough there to try, anyway
    var packet = buildPacket(buffer.bytes());
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

  var byteConcat = function (a, b){
      var aLength = a.length,
      result = new Uint8Array(aLength + b.length);
      result.set(a);
      result.set(b, aLength);
      return result;
  };

  var listenForPacket = function (timeout, callback) {
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      debug('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      var wholebytes = new Uint8Array([0]), pkt;

      while(serialDevice.hasAvailablePacket()) {
        clearInterval(listenTimer);
        pkt = serialDevice.nextPacket();
        wholebytes = byteConcat(wholebytes, pkt.bytes);
      }
      pkt = buildPacket(wholebytes);
      var tostr = String.fromCharCode.apply(String, pkt.bytes);
      debug('DEBUG OTU2 listenForPacket:', pkt, tostr);
      clearTimeout(abortTimer);
      clearInterval(listenTimer);

      callback(null, pkt);
    }, 1000);     // spin on this one not so quickly
  };

  var probe = function(cb){
    debug('not attempting probe of oneTouch Ultra2');
    cb();
  };

  var otu2CommandResponse = function (command, callback) {
    var cmd = struct.packString(command);
    serialDevice.writeSerial(cmd, function () {
      listenForPacket(18000, function(err, pkt) {
        callback(err, pkt);
      });
    });
  };

  var prepBGData = function (progress, data) {
    cfg.builder.setDefaults({ deviceId: data.id });
    var dataToPost = [];

    // this is converting the data bytes array to a string
    var lines = String.fromCharCode.apply(null, data.bytes);

    // separate each data row by \n
    var splites = lines.split('\n');
    var header = splites[0];

    // extract header
    var hpattern = /P (\d{3}),"(\w{9})","(\w+\/\w+).*" (\w+)/;

    var toMatch = hpattern.exec(header);

    //make sure the pattern matches
    if (!toMatch || toMatch.length !== 5){
        debug('Incorrect device header');
        return null;
    }

    var nrecords = toMatch[1],
        serialno = toMatch[2],
        oum = toMatch[3],
        checksum = toMatch[4],
        calcchks = 0;

    // set missing serial number and id
    data.serialNumber = serialno;
    data.id = 'OneTouchUltra2-' + serialno;

    oum = oum.toLowerCase();
    var len = oum.length - 1;
    var units = oum.substring(0, len) + oum.substr(len).toUpperCase();

    var sth = header.substr(0, header.indexOf(checksum) - 1);

    calcchks = _.reduce(sth, function (s1, e) {
                    return s1 + e.charCodeAt(0);
                }, 0);

    if(calcchks !== parseInt(checksum, 16)){
         debug('error...bad checksum in header', calcchks, checksum);
         return null;
     }

    // get data from lines
    var dpattern = /P "(\w+)","(\d{2}\/\d{2}\/\d{2})","(\d{2}:\d{2}:\d{2})   ","..(\d{3}).","(.)","(\d{2})",\W00\W(.+)/;
    var index = 0;
    _.forEach(splites.slice(1), function(l){ // <-- jump the header
        var ms = l.match(dpattern);
        index += 1;
        if(ms){
            var dow = ms[1], // day of week
                dor = ms[2], // date of reading
                tor = ms[3], // time of reading
                rf  = ms[4], // result
                alv = ms[5], // alpha value
                umc = ms[6], // numeric value for user meal comment
                chk = ms[7], // checksum
                createchk = 0;

            var st = l.substr(0, l.indexOf(chk) - 1);

            createchk = _.reduce(st, function (s1, e) {
                return s1 + e.charCodeAt(0);
            }, 0);

            if(createchk !== parseInt(chk, 16)){
              debug('error...bad checksum in data lines', createchk, chk);
              return null;
            } else {
              var jsDate = buildDateTime(dor, tor);

              var smbg = cfg.builder.makeSMBG()
                              .with_value(parseInt(rf))
                              .with_deviceTime(sundial.formatDeviceTime(jsDate))
                              .with_units(units)
                              .set('index',index);

              cfg.tzoUtil.fillInUTCInfo(smbg, jsDate);
              delete smbg.index;
              dataToPost.push(smbg.done());
            }
        }else{
          debug('ERROR: no match in dpattern:', l);
        }
    });

    return dataToPost;
  };

  return {
    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('in connect!');

      cfg.deviceComms.connect(data.deviceInfo, otu2MessageHandler, probe, function(err) {
        if (err) {
          return cb(err);
        }
        data.connect = true;
        cb(null, data);
      });
    },

    getConfigInfo: function (progress, data, cb) {
      // we don't do too much here
      debug('in getConfigInfo', data);
      progress(100);
      cb(null, data);
    },

    fetchData: function (progress, data, callback) {
      debug('in fetchData');

      var cmd = DMUpload;

      otu2CommandResponse(cmd, function(err, result){
          if (err) {
            debug('Failure trying to talk to device.');
            debug(err);
            debug(result);
            callback(err, null);
          } else {
            debug('fetchData otu2CommandResponse:', result);
            callback(null, result);
          }
      });
    },

    processData: function (progress, data, cb) {
      debug('in processData');
      progress(0);
      data.post_records = prepBGData(progress, data);
      data.processData = true;
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);

      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['LifeScan'],
        deviceModel: 'OneTouchUltra 2',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName : cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
        if (err) {
          debug(err);
          debug(result);
          progress(100);
          return cb(err, data);
        } else {
          progress(100);
          return cb(null, data);
        }
      });

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
        debug('progress: ', v);
      };
      var data = {};
      this.connect(progress, data, function(err, result) {
        debug('result:', result);
      });
    }
  };
};
