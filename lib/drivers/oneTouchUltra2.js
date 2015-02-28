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
 * Author: Patricio Valarezo (c) patovala@pupilabox.net.ec
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
  var MEC = [0x11, 0x0d, 0x0a];
  var DMF = MEC.concat([0x44, 0x4d, 0x46]);
  var DMV = MEC.concat([0x44, 0x4d, 0x3f]);

  var buildPacket = function (length, data) {
    var datalen = length;
    var buf = new ArrayBuffer(datalen);
    var bytes = new Uint8Array(buf);
    //var ctr = struct.pack(bytes, 0, 'bbbbbb', data);
    var ctr = struct.pack(bytes, 0, 'bbbbbb', 0x11, 0x0d, 0x0a, 0x44, 0x4d, 0x46);
    return buf;
  };

  var otu2MessageHandler = function (buffer) {

    //OneTouchUltra2 returns ascii, so let's see
    console.log('DEBUG OTU2 buffer', buffer.bytes());
    buffer.discard(buffer.length);
    return null;
    /*
    return packet = {
      bytes: buffer.length,
      valid: false,
      packet_len: 0,
      lcb: 0,
      lines: [],
      logEntries: []
    };
    */
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

  var probe = function (cb) {
    console.log('attempting probe of oneTouch Ultra2');

    var cmd = buildPacket(DMF.length, DMF);
    serialDevice.writeSerial(cmd, function () {
      // once we've sent the command, start listening for a response
      // but if we don't get one in 1 second give up
      listenForPacket(1000, cb);
    });
  };

  var getSomeInfo = function (obj, cb) {
      console.log('DEBUG: on getSomeInfo');
      cb()
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

      //add some timeout - maybe there is a better place to set this
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

    getConfigInfo: function (progress, data, cb) {
      // get the number of records
      progress(100);
      cb(null, data);
    },

    fetchData: function (progress, data, cb) {
      console.log('in fetchData');
      getAllData({}, function (err, result) {
        progress(100);
        data.connect = true;
        console.log(result);
        data.logEntries = result.logEntries;
        data.numEntries = result.numEntries;
        cb(null, data);
      });
    },

    processData: function (progress, data, cb) {
      progress(0);
      data.post_records = prepBGData(progress, data);
      progress(100);
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
