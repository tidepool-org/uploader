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
 * communication and data format according to specification document "DOC33891_rev-A.docx":
 * SPECIFICATION, SERIAL COMMANDS FOR EXTERNAL VENDOR, FREESTYLE LIBRE, PROJECT 22175 READER
 * */


var _ = require('lodash');
var async = require('async');
var sundial = require('sundial');
var crcCalculator = require('../../crc.js');
var struct = require('../../struct.js')();
var annotate = require('../../eventAnnotations');

var TZOUtil = require('../../TimezoneOffsetUtil');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('FreeStyleLibreDriver') : console.log;


module.exports = function (config) {
  var cfg = _.clone(config);
  var hidDevice = config.deviceComms;
  var messageBuffer = [];
  var HID_PACKET_SIZE = 64;
  var RETRIES = 6;
  // With no date & time settings changes available,
  // timezone is applied across-the-board
  cfg.tzoUtil = new TZOUtil(cfg.timezone, new Date().toISOString(), []);

  var ASCII_CONTROL = {
    ACK : 0x06,
    CR : 0x0D,
    ENQ : 0x05,
    EOT : 0x04,
    ETB : 0x17,
    ETX : 0x03,
    LF : 0x0A,
    NAK : 0x15,
    STX : 0x02
  };

  var probe = function(cb){
    debug('not using probe for Abbott FreeStyle Libre');
    cb();
  };

  var getOneRecord = function (data, callback) {
    callback(null, {});
  };
  
  var processReadings = function(readings) {
    return {};
  };
  
  var prepBGData = function(progress, data) {
    return {};
  };

  var buildPacket = function (command, cmdlength) {
    return new ArrayBuffer();
  };
  
  return {
    detect: function(deviceInfo, cb){
      debug('no detect function needed', arguments);
      cb(null, deviceInfo);
    },

    setup: function (deviceInfo, progress, cb) {
      debug('in setup!');
      progress(100);
      cb(null, {deviceInfo: deviceInfo});
    },

    connect: function (progress, data, cb) {
      debug('in connect!');

      cfg.deviceComms.connect(data.deviceInfo, probe, function(err) {
        if (err) {
          return cb(err);
        }
        data.disconnect = false;
        progress(100);
        cb(null, data);
      });
    },

    getConfigInfo: function (progress, data, cb) {
      debug('in getConfigInfo', data);

      getOneRecord({}, function (err, result) {
          progress(100);

          if(!err){
              data.connect = true;
              _.assign(data, result);

              cb(null, data);
          } else {
              return cb(err, result);
          }
      });
    },

    fetchData: function (progress, data, cb) {
      debug('in fetchData', data);

      var recordType = null;
      var dataRecords = [];
      var error = false;

      async.whilst(
        // Get records from the meter until we get the Message Terminator Record (L)
        // The spec says that unless we get this, any preceding data should not be used.
        function () { return (recordType !== ASCII_CONTROL.EOT && !error); },
        function (callback) {
          getOneRecord(data, function (err, result) {
            if (err) {
              error = true;
            } else {
              recordType = result.recordType;
              // We only collect data records (R)
              if (recordType === 'R' && result.timestamp) {
                progress(100.0 * result.nrec / data.nrecs);
                dataRecords.push(result);
              }
            }
            return callback(err);
          });
        },
        function (err) {
          progress(100);
          if(err || error) {
            data.bgmReadings = [];
          } else {
            debug('fetchData', dataRecords);
            data.bgmReadings = dataRecords;
          }
          data.fetchData = true;
          cb(err, data);
        }
      );
    },

    processData: function (progress, data, cb) {
      //debug('in processData');
      progress(0);
      data.bg_data = processReadings(data.bgmReadings);
      try {
        data.post_records = prepBGData(progress, data);
        var ids = {};
        for (var i = 0; i < data.post_records.length; ++i) {
          delete data.post_records[i].index; // Remove index as Jaeb study uses logIndices instead
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
      }
      catch(err) {
        cb(new Error(err), null);
      }
    },

    uploadData: function (progress, data, cb) {
      progress(0);
      //TODO: adapt these values
      var sessionInfo = {
        deviceTags: ['bgm'],
        deviceManufacturers: ['Bayer'],
        deviceModel: 'Contour Next',
        deviceSerialNumber: data.serialNumber,
        deviceId: data.id,
        start: sundial.utcDateString(),
        timeProcessing: cfg.tzoUtil.type,
        tzName : cfg.timezone,
        version: cfg.version
      };

      cfg.api.upload.toPlatform(data.post_records, sessionInfo, progress, cfg.groupId, function (err, result) {
        progress(100);

        if (err) {
          debug(err);
          debug(result);
          return cb(err, data);
        } else {
          data.cleanup = true;
          return cb(null, data);
        }
      });

    },

    disconnect: function (progress, data, cb) {
      debug('in disconnect');
      cfg.deviceComms.removeListeners();
      // Due to an upstream bug in HIDAPI on Windoze, we have to send a command
      // to the device to ensure that the listeners are removed before we disconnect
      // For more details, see https://github.com/node-hid/node-hid/issues/61
      hidDevice.send(buildPacket([ASCII_CONTROL.EOT], 1), function(err, result) {
        progress(100);
        cb(null, data);
      });
    },

    cleanup: function (progress, data, cb) {
      debug('in cleanup');
      if(!data.disconnect){
          cfg.deviceComms.disconnect(data, function() {
              progress(100);
              data.cleanup = true;
              data.disconnect = true;
              cb(null, data);
          });
      } else {
        progress(100);
      }
    }
  };
};
