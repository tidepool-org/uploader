var async = require('async');
var statusManager = require('./statusManager.js');

/* Here's what we want to do:
 call init() on every driver
 do forever:
 call detect() on every driver in a loop or when notified by an insertion
 when a device is detected:
 setup
 connect
 getConfigInfo
 fetchData
 processData
 uploadData
 disconnect
 cleanup
 */

module.exports = function (driverObjects, configs, enabledDevices) {
  var drivers = {};
  var required = [
    'enable',
    'disable',
    'detect',
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
    drivers[d].disable();
  }

  console.log(drivers);
  console.log(enabledDevices);
  for (d in enabledDevices) {
    drivers[enabledDevices[d]].enable();
  }

  var stat = statusManager({progress: null, steps: [
    { name: 'setting up', min: 0, max: 5 },
    { name: 'connecting', min: 5, max: 10 },
    { name: 'getting configuration data', min: 10, max: 20 },
    { name: 'fetching data', min: 20, max: 50 },
    { name: 'processing data', min: 50, max: 60 },
    { name: 'uploading data', min: 60, max: 90 },
    { name: 'disconnecting', min: 90, max: 95 },
    { name: 'cleaning up', min: 95, max: 100 }
  ]});

  return {
    // iterates the driver list and calls detect; returns the list
    // of driver keys for the ones that called the callback
    detect: function (cb) {
      console.log('detecting');
      var detectfuncs = [];
      for (var d in drivers) {
        detectfuncs.push(drivers[d].detect.bind(drivers[d], d));
      }
      async.series(detectfuncs, function(err, result) {
        if (err) {
          // something went wrong
          console.log('driver fail.');
          console.log(err);
          console.log(result);
          cb(err, result);
        } else {
          console.log("done with the series -- result = ", result);
          var ret = [];
          for (var r=0; r<result.length; ++r) {
            if (result[r]) {
              ret.push(result[r]);
            }
          }
          cb(null, ret);
        }
      });
    },

    process: function (driver, cb) {
      var drvr = drivers[driver];
      console.log(driver);
      console.log(drivers);
      // console.log(drvr);
      async.waterfall([
                        drvr.setup.bind(drvr, stat.statf(0)),
                        drvr.connect.bind(drvr, stat.statf(1)),
                        drvr.getConfigInfo.bind(drvr, stat.statf(2)),
                        drvr.fetchData.bind(drvr, stat.statf(3)),
                        drvr.processData.bind(drvr, stat.statf(4)),
                        drvr.uploadData.bind(drvr, stat.statf(5)),
                        drvr.disconnect.bind(drvr, stat.statf(6)),
                        drvr.cleanup.bind(drvr, stat.statf(7))
                      ], function(err, result) {
        setTimeout(stat.hideProgressBar, 1000);
        cb(err, result);
      });
    }
  };
};