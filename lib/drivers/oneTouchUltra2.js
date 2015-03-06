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
  var Initializer = '\x11\x0d';
  var DMDateTime = Initializer.concat('\x44\x4d\x46');
  var DMSoftVersion = Initializer.concat('\x44\x4d\x3f');
  var DMSerialNumber= Initializer.concat('\x44\x4d\x40');
  var DMUpload = Initializer.concat('\x44\x4d\x50');
  var DMGlucoseUnits = Initializer.concat('\x44\x4d\x53\x55\x3f');
  var DMTimeFormat = Initializer.concat('\x44\x4d\x53\x54\x3f');

  var otu2MessageHandler = function (buffer) {
    // This should be mostly informational
    console.log('DEBUG OTU2 buffer', buffer);
    //var result = String.fromCharCode.apply(String, buffer.bytes());
    //console.log(result);
    //buffer.discard(buffer.length);
    //return packet = {
    //  bytes: buffer.length,
    //  valid: false,
    //  packet_len: 0,
    //  lcb: 0,
    //  lines: [],
    //  logEntries: []
    //};
    return null;
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

  var listenForPacket = function (timeout, callback) {
    console.log('DEBUG listenForPacket');
    var abortTimer = setTimeout(function () {
      clearInterval(listenTimer);
      console.log('TIMEOUT');
      callback('TIMEOUT', null);
    }, timeout);

    var listenTimer = setInterval(function () {
      if (serialDevice.hasAvailablePacket()) {
        // FIX: call to extractPacket should be deleted!
        var pkt = serialDevice.nextPacket();
        // we always call the callback if we get a packet back,
        // so just cancel the timers if we do
        clearTimeout(abortTimer);
        clearInterval(listenTimer);
        console.log('DEBUG OTU2 hasAvailablePacket:', pkt);
        callback(null, pkt);
      }
    }, 20);     // spin on this one quickly
  };

  var probe = function(cb){
    console.log('attempting probe of oneTouch Ultra2');
    otu2CommandResponse(DMDateTime, cb);
  };

  var otu2CommandResponse = function (command, callback) {
    var cmd = struct.packString(commandpacket);
    serialDevice.writeSerial(cmd, function () {
      // mmm... no need to do this cause we have a handler
      listenForPacket(1000, callback);
    });
  };

  var getSomeInfo = function (obj, cb) {
      console.log('DEBUG: on getSomeInfo');
      cb();
  };

  var prepBGData = function (progress, data) {
    cfg.builder.setDefaults({ deviceId: data.id });
    var dataToPost = [];

    //PV log the data we are having
    console.log(data);
    console.log(data.logEntries);

    /*
    for (var i = 0; i < data.logEntries.length; ++i) {
      var datum = data.logEntries[i];
      if (datum.readingType === 'glucose') {
        var smbg = cfg.builder.makeSMBG()
          .with_value(datum.reading)
          .with_deviceTime(datum.datetime.dev)
          .with_timezoneOffset(datum.datetime.offset)
          .with_time(datum.datetime.utc)
          .with_units('mg/dL')
          .done();
        if (datum.annotations) {
          _.each(datum.annotations, function(ann) {
            annotate.annotateEvent(smbg, ann);
          });
        }
        dataToPost.push(smbg);
      } else if (datum.readingType === 'ketone') {
        // These meters store ketone values as 18 * the mmol/L value of the ketones
        // Because this is specific to these devices, we convert to mmol/L
        // in the driver, rounded to 2 decimal places.
        var ketoneValue = Math.round(100 * datum.reading / 18.0) / 100.0;
        var bloodKetone = cfg.builder.makeBloodKetone()
          .with_value(ketoneValue)
          .with_deviceTime(datum.datetime.dev)
          .with_timezoneOffset(datum.datetime.offset)
          .with_time(datum.datetime.utc)
          .done();
        if (datum.annotations) {
          _.each(datum.annotations, function(ann) {
            annotate.annotateEvent(smbg, ann);
          });
        }
        dataToPost.push(bloodKetone);
        console.log('ketone: ', bloodKetone);
      }
    }
    */

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
          console.log(data);
          cb(null, data);
        });
      });
    },

    fetchData: function (progress, data, callback) {
      console.log('in fetchData');
      var cmd = DMUpload;

      otu2CommandResponse(cmd, function(err, result){
          if (err) {
              console.log('Failure trying to talk to device.');
              console.log(err);
              console.log(result);
              callback(err, null);
          } else {
              //PV grow up the results
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
      console.log(data);
      cb(null, data);
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Abbott'],
        deviceModel: 'FreeStyle Precision Xtra',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        tzName : cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
        if (err) {
          console.log(err);
          console.log(result);
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
        console.log('progress: ', v);
      };
      var data = {};
      this.connect(progress, data, function(err, result) {
        console.log('result:', result);
      });
    }
  };
};
