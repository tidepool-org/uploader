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
var util = require('util');

var csv = require('babyparse');
var sundial = require('sundial');

var common = require('../carelink/common');
var debug = require('../bows')('CarelinkDriver');
var removeOverlaps = require('../carelink/removeOverlapping');
var getDeviceInfo = require('../carelink/getDeviceInfo');
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

function initializeProcessors(timezone, model) {
  // Order of these matters, each processor delivers events to the simulator, so the order that the processors
  // are visited determines the order that events will be delivered to the simulator.  Keep this in mind when
  // re-ordering.
  return [
    require('../carelink/settings.js')(timezone),
    require('../carelink/smbg.js')(timezone),
    require('../carelink/cbg.js')(timezone),
    require('../carelink/basal.js')(timezone),
    require('../carelink/suspend.js')(timezone),
    require('../carelink/bolusNWizard')(timezone, model)
  ];
}

module.exports = function(simulatorMaker, api){

  var typesToRead = {
    // basal
    'BasalProfileStart': true,
    'ChangeTempBasalPercent': true,
    'ChangeTempBasal': true,
    // bolus and wizard
    'BolusNormal': true,
    'BolusSquare': true,
    'BolusWizardBolusEstimate': true,
    // cbg
    'GlucoseSensorData': true,
    'GlucoseSensorDataHigh': true,
    'GlucoseSensorDataLow': true,
    // settings
    'ChangeBasalProfile': true,
    'ChangeBasalProfilePre': true,
    'CurrentBasalProfile': true,
    'ChangeBGTargetRange': true,
    'ChangeBGTargetRangePattern': true,
    'CurrentBGTargetRange': true,
    'ChangeCarbRatio': true,
    'ChangeCarbRatioPattern': true,
    'CurrentCarbRatio': true,
    'ChangeInsulinSensitivity': true,
    'ChangeInsulinSensitivityPattern': true,
    'CurrentInsulinSensitivity': true,
    'CurrentActiveBasalProfilePattern': true,
    'CurrentBasalProfilePattern': true,
    'CurrentBGTargetRangePattern': true,
    'CurrentBolusWizardBGUnits': true,
    'CurrentBolusWizardCarbUnits': true,
    'CurrentBolusWizardEnable': true,
    'CurrentCarbRatioPattern': true,
    'CurrentInsulinSensitivityPattern': true,
    'ChangeBolusWizardSetup': true,
    'ChangeBolusWizardSetupConfig': true,
    'ChangeBasalProfilePattern': true,
    'ChangeBasalProfilePatternPre': true,
    'ChangeActiveBasalProfilePattern': true,
    // smbg
    'CalBGForPH': true,
    // suspend
    'ChangeSuspendEnable': true
  };
  return function (config) {
    if (config.timezone == null) {
      throw new Error('carelinkDriver\'s config must specify a timezone');
    }

    var cfg = config, _enabled;

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
        debug('Carelink Detect!');
        cb(null, obj);
      },

      // this function starts the chain, so it has to create but not accept
      // the result (data) object; it's then passed down the rest of the chain
      setup: function (deviceInfo, progress, cb) {
        debug('Carelink Setup!');
        progress(100);

        deviceInfo = deviceInfo || {};

        cb(null, { devices : deviceInfo });
      },

      connect: function (progress, payload, cb) {
        debug('Carelink Connect!');
        progress(100);
        cb(null, payload);
      },

      getConfigInfo: function (progress, payload, cb) {
        debug('Carelink GetConfigInfo!');
        progress(100);
        cb(null, payload);
      },

      fetchData: function (progress, payload, cb) {

        debug('Carelink FetchData!');
        debug('Carelink data', cfg.fileData.length);

        var endOfPreamble = cfg.fileData.indexOf('Index');
        // Setup the preamble to have everything up to the header line
        payload.preamble = csv.parse(cfg.fileData.substr(0, endOfPreamble), {});
        cfg.deviceInfo = getDeviceInfo(payload.preamble.data, /Pump/);
        // Store the rest of the data
        payload.theData = csv.parse(cfg.fileData.substr(endOfPreamble), {
          header: true,
          dynamicTyping: true
        }).data;

        for (var i = 0; i < payload.theData.length; ++i) {
          convertRawValues(payload.theData[i]);
          payload.theData[i].deviceTime = sundial.parseFromFormat(payload.theData[i]['Timestamp'], CARELINK_TS_FORMAT);
        }

        payload.theData = _.filter(payload.theData, function(datum) {
          return typesToRead[datum['Raw-Type']];
        });

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
      },

      processData: function (progress, payload, cb) {
        debug('Carelink ProcessData!');
        debug('Find and remove overlapping uploads from the same device model');
        var uploads = removeOverlaps(payload);
        progress(20);

        debug('Separate into per-device arrays');
        for (var k = 0; k < payload.theData.length; ++k) {
          var key = payload.theData[k]['Raw-Device Type'];
          var device = payload.devices[key];
          if (device == null) {
            device = {};
            payload.devices[key] = device;
            device.simulator = simulatorMaker.make(
              {
                autoGenScheduleds: common.autoGenModels[key] ? true : false,
                defaults: { source: 'carelink' }
              });
            device.processors = initializeProcessors(cfg.timezone, key);

            device.data = [];
          }
          if (uploads[payload.theData[k]['Raw-Upload ID']] != null) {
            device.data.push(payload.theData[k]);
          }
        }
        delete payload.theData;

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
        debug('Carelink UploadData!');
        payload.post_records = [];

        async.map(Object.keys(payload.devices), function(key, done) {
          var deviceRecords = payload.devices[key].simulator.getEvents();
          var deviceIds = _.uniq(_.pluck(deviceRecords, 'deviceId'));
          var sessionInfo = {
            deviceTags: ['insulin-pump'],
            deviceManufacturers: ['Medtronic'],
            deviceModel: cfg.deviceInfo.getDeviceModel(),
            deviceSerialNumber: cfg.deviceInfo.getDeviceSerialNumber(),
            deviceId: deviceIds.length > 1 ? 'multiple': deviceIds[0],
            start: sundial.utcDateString(),
            tzName : cfg.timezone,
            version: cfg.version
          };
          if (cfg.deviceInfo.hasMultiple()) {
            sessionInfo.payload = cfg.deviceInfo.getPayload();
          }
          api.upload.toPlatform(
            deviceRecords,
            sessionInfo,
            progress,
            cfg.groupId,
            function (err, result) {
            if (err) {
              debug(err);
              debug(result);
              return done(err);
            }

            payload.post_records = payload.post_records.concat(deviceRecords);
            return done();
          });
        }, function(err) {
          if (err) {
            progress(100);
            cb(err);
          }
          progress(100);
          cb(null, payload);
        });
      },

      disconnect: function (progress, payload, cb) {
        debug('Carelink Disconnect!');
        progress(100);
        cb(null, payload);
      },

      cleanup: function (progress, payload, cb) {
        debug('Carelink Cleanup!');
        progress(100);
        cb(null, payload);
      }
    };
  };
};
