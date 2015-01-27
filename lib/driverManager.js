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

var async = require('async');
var statusManager = require('./statusManager.js');
var debug = require('./bows')('DriverManager');

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
    drivers[d] = driverObjects[d](configs[d]);
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
        { name: required[0], min: 0, max: 5 },
        { name: required[1], min: 5, max: 10 },
        { name: required[2], min: 10, max: 20 },
        { name: required[3], min: 20, max: 50 },
        { name: required[4], min: 50, max: 60 },
        { name: required[5], min: 60, max: 90 },
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
          drvr.getConfigInfo.bind(drvr, noop),
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
      async.waterfall([
        drvr.setup.bind(drvr, deviceInfo, stat.progressForStep(0)),
        drvr.connect.bind(drvr, stat.progressForStep(1)),
        drvr.getConfigInfo.bind(drvr, stat.progressForStep(2)),
        drvr.fetchData.bind(drvr, stat.progressForStep(3)),
        drvr.processData.bind(drvr, stat.progressForStep(4)),
        drvr.uploadData.bind(drvr, stat.progressForStep(5)),
        drvr.disconnect.bind(drvr, stat.progressForStep(6))
      ], function(err, result) {
        result = result || {};
        drvr.cleanup(stat.progressForStep(7), result, function() {
          cb(err, result);
        });
      });
    }
  };
};
