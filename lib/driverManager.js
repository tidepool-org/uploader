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

  for (var d in driverObjects) {
    drivers[d] = driverObjects[d](configs[d]);
    console.log(drivers[d]);
    for (var i=0; i<required.length; ++i) {
      if (typeof(drivers[d][required[i]]) != 'function') {
        console.log('!!!! Driver %s must implement %s', d, required[i]);
      }
    }
  }

  // console.log(drivers);

  var stat = statusManager({progress_bar: configs, steps: [
    { name: 'Setting up...', min: 0, max: 5 },
    { name: 'Connecting...', min: 5, max: 10 },
    { name: 'Getting configuration...', min: 10, max: 20 },
    { name: 'Fetching data...', min: 20, max: 50 },
    { name: 'Processing data...', min: 50, max: 60 },
    { name: 'Uploading data...', min: 60, max: 90 },
    { name: 'Disconnecting...', min: 90, max: 95 },
    { name: 'Cleaning up...', min: 95, max: 100 }
  ]});

  return {
    detect: function(driver, cb) {
      drivers[driver].detect(cb);
    },

    process: function (driver, cb) {
      var drvr = drivers[driver];
      console.log(driver);
      console.log(drivers);
      console.log(configs[driver]);
      stat.showProgressBar(configs[driver].progress_bar, configs[driver].status_text);
      async.waterfall([
                        drvr.setup.bind(drvr, stat.statf(0)),
                        drvr.connect.bind(drvr, stat.statf(1)),
                        drvr.getConfigInfo.bind(drvr, stat.statf(2)),
                        drvr.fetchData.bind(drvr, stat.statf(3)),
                        drvr.processData.bind(drvr, stat.statf(4)),
                        drvr.uploadData.bind(drvr, stat.statf(5)),
                        drvr.disconnect.bind(drvr, stat.statf(6))
                      ], function(err, result) {
        drvr.cleanup(stat.statf(7), result, function() {
          if (err) {
            stat.progress('An error occurred: ' + err, 0);
          } else {
            stat.progress('Uploaded!', 100);
          }
          setTimeout(stat.hideProgressBar, 1000);
          cb(err, result);
        });
      });
    }
  };
};