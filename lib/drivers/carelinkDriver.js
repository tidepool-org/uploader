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

var TZOUtil = require('../TimezoneOffsetUtil');

var common = require('../carelink/common');
var debug = require('../bows')('CareLinkDriver');
var removeOverlaps = require('../carelink/removeOverlapping');
var getDeviceInfo = require('../carelink/getDeviceInfo');
var timeChangeProcessor = require('../carelink/timeChange')();
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

function initializeProcessors(opts) {
  // Order of these matters, each processor delivers events to the simulator, so the order that the processors
  // are visited determines the order that events will be delivered to the simulator.  Keep this in mind when
  // re-ordering.
  return [
    require('../carelink/settings.js')(opts),
    require('../carelink/smbg.js')(opts),
    require('../carelink/cbg.js')(opts),
    require('../carelink/basal.js')(),
    require('../carelink/suspend.js')(),
    require('../carelink/bolusNWizard')(opts)
  ];
}

module.exports = function(simulatorMaker, api){

  var typesToRead = {
    // basal
    'BasalProfileStart': true,
    'ChangeTempBasalPercent': true,
    'ChangeTempBasal': true,
    'ChangeTime': true,
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
        var parsed = csv.parse(cfg.fileData.substr(endOfPreamble), {
          header: true,
          dynamicTyping: true
        });
        payload.colLabels = parsed.meta;
        var rows = [];

        for (var i = 0; i < parsed.data.length; ++i) {
          var datum = parsed.data[i];
          convertRawValues(datum);
          datum.jsDate = sundial.parseFromFormat(datum['Timestamp'], CARELINK_TS_FORMAT);
          datum.deviceTime = sundial.formatDeviceTime(datum.jsDate);
          datum.index = datum['Index'];
          if (!_.isEmpty(datum['Raw-Values'])) {
            rows.push(datum);
          }
        }
        delete parsed.data;

        payload.theData = _.filter(rows, function(datum) {
          return typesToRead[datum['Raw-Type']];
        });

        debug('Find and remove overlapping uploads from the same device model');
        var uploads = removeOverlaps(payload);

        debug('Separate into per-device arrays');
        for (var k = 0; k < payload.theData.length; ++k) {
          var key = payload.theData[k]['Raw-Device Type'];
          var device = payload.devices[key];
          if (device == null) {
            device = {};
            payload.devices[key] = device;

            device.data = [];
          }
          if (uploads[payload.theData[k]['Raw-Upload ID']] != null) {
            device.data.push(payload.theData[k]);
          }
        }
        delete payload.theData;

        Object.keys(payload.devices).forEach(function(key) {
          var device = payload.devices[key];
          var mostRecentDatum = device.data[device.data.length - 1];
          var mostRecent = sundial.applyTimezone(mostRecentDatum.jsDate, cfg.timezone).toISOString();
          debug(util.format('Most recent timestamp for device %s: %s', key, mostRecentDatum.deviceTime));

          var bisection = _.partition(device.data, function(datum) {
            return datum['Raw-Type'] !== 'ChangeTime';
          });
          device.data = bisection[0];
          var dateTimeSettingsChangeRows = bisection[1];
          var changes = [];
          for (var j = 0; j < dateTimeSettingsChangeRows.length; ++j) {
            timeChangeProcessor(changes, dateTimeSettingsChangeRows[j]);
          }
          cfg.tzoUtil = new TZOUtil(cfg.timezone, mostRecent, changes);
          device.timeChanges = _.map(
            cfg.tzoUtil.records,
            function(rec) { return _.omit(rec, 'index'); }
          );
          _.each(device.data, function(datum) {
            cfg.tzoUtil.fillInUTCInfo(datum, datum.jsDate);
          });
          device.data.sort(function(lhs, rhs) {
            if (lhs.time < rhs.time) {
              return -1;
            } else if (lhs.time > rhs.time) {
              return 1;
            } else if (lhs['Raw-ID'] < rhs['Raw-ID']) {
              return -1;
            } else if (lhs['Raw-ID'] > rhs['Raw-ID']) {
              return 1;
            }
            return 0;
          });
        });

        cb(null, payload);
      },

      processData: function (progress, payload, cb) {
        debug('Carelink ProcessData!');
        progress(20);

        function getUnits(colName) {
          var units = null;
          if (colName.search('mg/dL') !== -1) {
            units = 'mg/dL';
          }
          else if (colName.search('mmol/L') !== -1) {
            units = 'mmol/L';
          }
          if (units != null) {
            return units;
          }
          else {
            throw new Error(util.format('CalBGForPH column label[%s] units not recognized!', colName));
          }
        }

        var colNames = {};

        function findColName(name) {
          var retVal = null;
          for (var i = 0; i < payload.colLabels.fields.length; ++i) {
            var label = payload.colLabels.fields[i];
            if (label.search(name) !== -1) {
              retVal = label;
              break;
            }
          }
          return retVal;
        }

        // some column headers include units - mg/dL or mmol/L
        // so we have to figure out which we have for the processors
        colNames.bgInput = findColName('BWZ BG Input');
        colNames.bgTargetHigh = findColName('BWZ Target High BG');
        colNames.bgTargetLow = findColName('BWZ Target Low BG');
        colNames.insulinSensitivity = findColName('BWZ Insulin Sensitivity');
        colNames.sensorGlucose = findColName('Sensor Glucose');
        colNames.CalBGForPH = findColName('Sensor Calibration BG');
        var units = getUnits(colNames.CalBGForPH);

        progress(100);
        Object.keys(payload.devices).forEach(function(key){
          var device = payload.devices[key];
          device.simulator = simulatorMaker.make(
            {
              autoGenScheduleds: common.autoGenModels[key] ? true : false,
              defaults: { source: 'carelink' }
            });
          device.processors = initializeProcessors({model: key, units: units, colNames: colNames});

          var events = device.data;

          for (var i = 0; i < events.length; ++i) {
            for (var j = 0; j < device.processors.length; ++j) {
              device.processors[j](device.simulator, events[i], i, events);
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
          if (payload.devices[key].timeChanges) {
            deviceRecords = deviceRecords.concat(
              _.map(
                payload.devices[key].timeChanges,
                function(d) { return _.omit(d, 'model'); }
              )
            );
          }
          var deviceIds = _.uniq(_.pluck(deviceRecords, 'deviceId'));
          var sessionInfo = {
            deviceTags: ['insulin-pump'],
            deviceManufacturers: ['Medtronic'],
            deviceModel: cfg.deviceInfo.getDeviceModel(),
            deviceSerialNumber: cfg.deviceInfo.getDeviceSerialNumber(),
            deviceId: deviceIds.length > 1 ? 'multiple': deviceIds[0],
            start: sundial.utcDateString(),
            timeProcessing: cfg.tzoUtil.type,
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
