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
 *
 * The registers looks like:
 * P "SAT","03/21/15","16:45:24   ","  081 ","N","03", 00 09B6
 * P "SAT","03/21/15","16:42:11   ","  105 ","B","02", 00 099F
 * P "SAT","03/21/15","16:39:46   ","  176 ","N","02", 00 09C1
 *
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

  function buildDateTime(date, time) {
    var fmt = 'MM/DD/YY HH:mm:ss';
    var ddate = date + ' ' + time;
    var parsed = sundial.parseFromFormat(ddate, fmt);
    var dev = sundial.formatDeviceTime(parsed);
    var utc = sundial.applyTimezone(dev, cfg.timezone).toISOString();
    var offset = sundial.getOffsetFromZone(utc, cfg.timezone);
    return { dev: dev, utc: utc, offset: offset };
  }

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
      var wholebytes = new Uint8Array([0]), pkt;

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
    }, 1000);     // spin on this one not so quickly
  };

  var probe = function(cb){
    console.log('attempting probe of oneTouch Ultra2 - don\'t probe anything');
    //otu2CommandResponse(DM, cb);
    cb();
  };

  var otu2CommandResponse = function (command, callback) {
    var cmd = struct.packString(command);
    serialDevice.writeSerial(cmd, function () {
      listenForPacket(18000, function(err, pkt) {
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

    //This is converting to a string the data bytes array
    var lines = String.fromCharCode.apply(null, data.bytes);

    //Separe each data row by \n
    var splites = lines.split('\n');

    // extract header
    var hpattern = /P (\d{3}),"(\w{9})","(\w+\/\w+).*" (\w+)/;

    var toMatch = hpattern.exec(splites[0]);
    var nrecords = toMatch[1],
        serialno = toMatch[2],
        oum = toMatch[3],
        checksum = toMatch[4],
        calcchks = 0;

    // var bytes = data.bytes.subarray(0, 27, 0);
    var stringWithoutChk = 'P ' + nrecords + ',"' + serialno + '","' + oum + ' "';
    var bytes = [0];

    for (var i = 0; i < stringWithoutChk.length; ++i)
    {
        bytes.push(stringWithoutChk.charCodeAt(i));
    }

    calcchks = _.reduce(bytes, function(s1, e){ return s1 + e;}, 0);

    if(calcchks !== parseInt(checksum, 16)){
         console.log('hmmm...bad checksum', calcchks, checksum);
         return null;
     }

    // get data from lines
    var dpattern = /P "(\w+)","(\d{2}\/\d{2}\/\d{2})","(\d{2}:\d{2}:\d{2})   ","..(\d{3}).","(.)","(\d{2})",\W00\W(.+)/;
    _.forEach(splites.slice(1), function(l){ // <-- jump the header
        var ms = l.match(dpattern);
        if(ms){
            var dow = ms[1], // day of week
                dor = ms[2], // date of reading
                tor = ms[3], // time of reading
                rf  = ms[4], // result
                alv = ms[5], // alpha value
                umc = ms[6], // numeric value for user meal comment
                chk = ms[7]; // checksum
                createchk = 0;

            var lineWithoutChecksum = 'P "' + dow + '","'+ dor + '","' + tor + '   ", "' + rf + ' ","' + alv + '","' + umc + '", 00 ';
            var arrayBytes = [0];

            for (var i = 0; i < lineWithoutChecksum.length; ++i)
            {
                arrayBytes.push(lineWithoutChecksum.charCodeAt(i));
            }

            createchk = _.reduce(arrayBytes, function(s1, e){ return s1 + e;}, 0);

            if(createchk !== parseInt(chk, 16)){
              console.log('hmmm...bad checksum', createchk, chk);
              return null;
            } else {
              var bdt = buildDateTime(dor, tor);

              var smbg = cfg.builder.makeSMBG()
                              .with_value(rf)
                              .with_deviceTime(bdt.dev)
                              .with_time(bdt.utc)
                              .with_timezoneOffset(bdt.offset)
                              .with_units('mg/dL')
                              .done();
              dataToPost.push(smbg);
            }
        }
    });

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
