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

var util = require('util');

var csv = require('babyparse');
var sundial = require('sundial');

var CARELINK_TS_FORMAT = 'MM/DD/YY HH:mm:ss';

function convertRawValues(e) {
  var RAW_VALUES = e['Raw-Values'];
  if (RAW_VALUES == null || RAW_VALUES === '') {
    e['Raw-Values'] = null;
    return e;
  }

  var rawVals = {};
  var keyValSplits = RAW_VALUES.split(',');
  for (var i = 0; i < keyValSplits.length; ++i) {
    var keyVal = keyValSplits[i].trim().split('=');
    if (keyVal.length !== 2) {
      throw new Error(util.format('keyVal didn\'t split on \'=\' well[%s], input was[%j]', keyValSplits[i], e));
    }
    rawVals[keyVal[0]] = keyVal[1];
  }

  e['Raw-Values'] = rawVals;
  return e;
}

function initializeProcessors(timezone) {
  // Order of these matters, each processor delivers events to the simulator, so the order that the processors
  // are visited determines the order that events will be delivered to the simulator.  Keep this in mind when
  // re-ordering.
  return [
    require('./settings.js')(timezone),
    require('./smbg.js')(timezone),
    require('./cbg.js')(timezone),
    require('./basal.js')(timezone),
    require('./suspend.js')(timezone),
    require('./bolusNWizard')(timezone)
  ];
}

module.exports = function(simulatorMaker){
  return function (config) {
    if (config.timezone == null) {
      throw new Error('carelinkDriver\'s config must specify a timezone');
    }

    var cfg = config;

    return {
      enable: function() {
        _enabled = true;
      },

      disable: function() {
        _enabled = false;
      },

      // should call the callback with null, obj if the item
      // was detected, with null, null if not detected.
      // call err only if there's something unrecoverable.
      detect: function (obj, cb) {
        console.log('Carelink Detect!');
        cb(null, obj);
      },

      // this function starts the chain, so it has to create but not accept
      // the result (data) object; it's then passed down the rest of the chain
      setup: function (progress, cb) {
        console.log('Carelink Setup!');
        progress(100);
        cb(null, { devices : {} });
      },

      connect: function (progress, payload, cb) {
        console.log('Carelink Connect!');
        progress(100);
        cb(null, payload);
      },

      getConfigInfo: function (progress, payload, cb) {
        console.log('Carelink GetConfigInfo!');
        progress(100);
        cb(null, payload);
      },

      fetchData: function (progress, payload, cb) {
        console.log('Carelink FetchData!');

        if (cfg.username != null) {
          indgestion.carelink.fetch(
            {
              username: cfg.username,
              password: cfg.password,
              daysAgo: 180
            },
            function (err, csvStream) {
              progress(100);
              payload.csvStream = csvStream;
              cb(err, payload);
            }
          );
        } else if (cfg.filename != null) {
          console.log('Carelink file', cfg.filename);
          console.log('Carelink data', cfg.fileData.length);

          var endOfPreamble = cfg.fileData.indexOf('Index');
          // Setup the preamble to have everything up to the header line
          payload.preamble = csv.parse(cfg.fileData.substr(0, endOfPreamble), {});
          // Store the rest of the data
          payload.theData = csv.parse(cfg.fileData.substr(endOfPreamble), {
            header: true,
            dynamicTyping: true
          }).data;

          for (var i = 0; i < payload.theData.length; ++i) {
            convertRawValues(payload.theData[i]);
            payload.theData[i].deviceTime = sundial.parseFormat(payload.theData[i]['Timestamp'], CARELINK_TS_FORMAT);
          }

          payload.theData.sort(function(lhs, rhs){
            if (lhs.deviceTime < rhs.deviceTime) {
              return -1;
            } else if (lhs.deviceTime > rhs.deviceTime) {
              return 1;
            } else if (lhs['Raw-ID'] < rhs['Raw-ID']) {
              return -1;
            } else if (lhs['Raw-ID'] > rhs['Raw-ID']) {
              return 1;
            }
            return 0;
          });

          cb(null, payload);
        } else {
          cb('Unknown carelink config', cfg);
        }
      },

      processData: function (progress, payload, cb) {
        console.log('Carelink ProcessData!');
        console.log('Separate into per-device arrays');
        for (var i = 0; i < payload.theData.length; ++i) {
          var key = payload.theData[i]['Raw-Device Type'];
          var device = payload.devices[key];
          if (device == null) {
            device = {};
            payload.devices[key] = device;
            device.simulator = simulatorMaker.make({ source: 'carelink' });
            device.processors = initializeProcessors(cfg.timezone);

            device.data = [];
          }
          device.data.push(payload.theData[i]);
        }
        delete payload.theData;
        progress(20);

        progress(100);
        Object.keys(payload.devices).forEach(function(device){
          var events = payload.devices[device].data;
          var simulator = payload.devices[device].simulator;
          var processors = payload.devices[device].processors;

          for (var i = 0; i < events.length; ++i) {
            for (var j = 0; j < processors.length; ++j) {
              processors[j](simulator, events[i], i, events);
            }
          }
        });
        cb(null, payload);
      },

      uploadData: function (progress, payload, cb) {
        console.log('Carelink UploadData!');
        console.log(payload.simulator.getEvents());
        progress(100);
        cb(null, payload);
      },

      disconnect: function (progress, payload, cb) {
        console.log('Carelink Disconnect!');
        progress(100);
        cb(null, payload);
      },

      cleanup: function (progress, payload, cb) {
        console.log('Carelink Cleanup!');
        progress(100);
        cb(null, payload);
      }
    };
  };
};