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

var _ = require('lodash');
var async = require('async');
var statusManager = require('./statusManager.js');
var debug = require('bows')('DriverManager');
var isBrowser = typeof window !== 'undefined';

module.exports = function (driverObjects, configs) {
  var drivers = {};
  var required = [
    'setup',
    'connect',
    'getConfigInfo',
    'fetchData',
    'processData',
    'uploadData',
    'disconnect',
    'cleanup',
  ];
  var noop = function() {};

  for (var d in driverObjects) {
    try {
      drivers[d] = driverObjects[d](configs[d]);
    } catch (e) {
      debug('Driver not available.');
      return null;
    }

    for (var i=0; i<required.length; ++i) {
      if (typeof(drivers[d][required[i]]) != 'function') {
        debug('!!!! Driver %s must implement %s', d, required[i]);
      }
    }
  }

  var createStat = function(driver) {
    var progress = configs[driver].progress || noop;
    return statusManager({
      progress: progress,
      steps: [
        { name: required[0], min: 0, max: 3 },
        { name: required[1], min: 3, max: 6 },
        { name: required[2], min: 6, max: 10 },
        { name: required[3], min: 10, max: 70 },
        { name: required[4], min: 70, max: 75 },
        { name: required[5], min: 75, max: 90 },
        { name: required[6], min: 90, max: 95 },
        { name: required[7], min: 95, max: 100 }
      ]
    });
  };

  return {
    detect: function(driver, cb) {

      // if the driver supplies a detect function, call it, but if not,
      // we call the first three upload functions with a noop progress function.
      var deviceInfo = configs[driver].deviceInfo;
      if (drivers[driver].detect) {
        drivers[driver].detect(deviceInfo, cb);
      } else {
        var drvr = drivers[driver];
        async.waterfall([
          drvr.setup.bind(drvr, deviceInfo, noop),
          drvr.connect.bind(drvr, noop),
          drvr.disconnect.bind(drvr, noop)
        ], function(err, result) {
          result = result || {};
          drvr.cleanup(noop, result, function() {
            if (err) {
              cb(err, result);
            } else {
              cb(null, {
                model: result.model,
                serialNumber: result.serialNumber,
                id: result.id
              });
            }
          });
        });
      }
    },

    // note that this assumes driver info was set up
    process: function (driver, cb) {
      var deviceInfo = configs[driver].deviceInfo;
      var drvr = drivers[driver];
      var stat = createStat(driver);


      function connect(data, next){
        try{
          drvr.connect(stat.progressForStep(1), data, next);
        } catch (connectError) {
          connectError.step = 'connect';
          return next(connectError);
        }
      }
      function getConfigInfo(data, next){
        try{
          drvr.getConfigInfo(stat.progressForStep(2), data, next);
        } catch (configError) {
          configError.step = 'getConfigInfo';
          return next(configError);
        }
      }
      function fetchData(data, next){
        try{
          drvr.fetchData(stat.progressForStep(3), data, next);
        } catch (fetchDataError) {
          fetchDataError.step = 'fetchData';
          return next(fetchDataError);
        }
      }
      function uploadBlob(data, next) {
        if(isBrowser && (_.isArray(
          data.pages ||              // Medtronic 500/700-series and 600-series
          data.aapPackets) ||        // Abbott Libre
          _.isArrayBuffer(data.filedata) // OmniPod & LibreView
        )) {
          let contentType = 'application/json';
          let dataBinary = null;

          if (data.filedata) {
            contentType = 'application/octet-stream';
            dataBinary = new Uint8Array(data.filedata);
          } else {
            const blob = _.omit(data, ['post_records']);
            dataBinary = JSON.stringify(blob, undefined, 4);
          }

          console.time('upload blob elapsed');
          configs[driver].api.upload.blob(dataBinary, contentType, function (err, result) {
            if (err) {
              // we shouldn't fail if we can't upload the binary blob
              debug(err);
            }

            if (result && result.id) {
              debug('Blob ID:', result.id);
              data.blobId = result.id;
            }

            console.timeEnd('upload blob elapsed');
            return next(null, data);
          });
        } else {
          return next(null, data);
        }
      }
      function processData(data, next){
        try{
          drvr.processData(stat.progressForStep(4), data, next);
        } catch (processDataError) {
          processDataError.step = 'processData';
          return next(processDataError);
        }
      }
      function uploadData(data, next){
        try{
          drvr.uploadData(stat.progressForStep(5), data, next);
        } catch (uploadDataError) {
          uploadDataError.step = 'uploadData';
          return next(uploadDataError);
        }
      }
      function disconnect(data, next){
        try{
          drvr.disconnect(stat.progressForStep(6), data, next);
        } catch (disconnectError) {
          disconnectError.step = 'disconnect';
          return next(disconnectError);
        }
      }

      // no try/catch for local development is the easiest/only(?) way to get good stack traces!
      if (configs.debug === true) {
        debug('DriverManager set up in debug mode: all non-device comms errors will throw in console.');
        console.time('total time elapsed');
        async.waterfall([
          drvr.setup.bind(drvr, deviceInfo, stat.progressForStep(0)),
          drvr.connect.bind(drvr, stat.progressForStep(1)),
          drvr.getConfigInfo.bind(drvr, stat.progressForStep(2)),
          drvr.fetchData.bind(drvr, stat.progressForStep(3)),
          uploadBlob,
          drvr.processData.bind(drvr, stat.progressForStep(4)),
          drvr.uploadData.bind(drvr, stat.progressForStep(5)),
          drvr.disconnect.bind(drvr, stat.progressForStep(6))
        ], function(err, result) {
          result = result || {};
          drvr.cleanup(stat.progressForStep(7), result, function() {
            console.timeEnd('total time elapsed');

            if(isBrowser) {
              var snd;
              if(err) {
                snd = new Audio('../sounds/UploadFailed.wav');
              } else {
                snd = new Audio('../sounds/UploadSucceeded.wav');
              }
              snd.play();
            }

            cb(err, result);
          });
        });
      }
      else {
        debug('DriverManager set up in normal mode: all errors will surface in UI only.');
        console.time('total time elapsed');
        async.waterfall([
          drvr.setup.bind(drvr, deviceInfo, stat.progressForStep(0)),
          connect,
          getConfigInfo,
          fetchData,
          uploadBlob,
          processData,
          uploadData,
          disconnect
        ], function(err, result) {
          result = result || {};
          drvr.cleanup(stat.progressForStep(7), result, function() {
            console.timeEnd('total time elapsed');

            if(isBrowser) {
              var snd;
              if(err) {
                snd = new Audio('../sounds/UploadFailed.wav');
              } else {
                snd = new Audio('../sounds/UploadSucceeded.wav');
              }
              snd.play();
            }

            cb(err, result);
          });
        });
      }
    }
  };
};
