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
var sundial = require('sundial');
var util = require('util');

var parsing = require('./parsing.js');

exports.autoGenModels = {
  'Paradigm 522': true,
  'Paradigm 722': true
};

exports.makeCommonVals = function(timezone){
  return function (line) {
    var deviceTime = sundial.formatDeviceTime(line.deviceTime);
    var time = sundial.applyTimezone(deviceTime, timezone).toISOString();

    return {
      deviceTime: deviceTime,
      time: time,
      timezoneOffset: sundial.getOffsetFromZone(time, timezone),
      deviceId: line['Raw-Device Type'] + '-=-' + line['Raw-Upload ID'],
      // TODO: delete after conclusion of Jaeb study
      jaebPayload: {
        rawSeqNums: [line['Raw-Seq Num']],
        rawUploadId: line['Raw-Upload ID']
      }
      // TODO: end deletion
    };
  };
};

exports.makeParser = function (specs) {
  var retVal = parsing.parserBuilder();

  Object.keys(specs).forEach(function (key) {
    retVal.whenFieldIs('Raw-Type', key).applyConversion(specs[key]);
  });

  return retVal.build();
};

/**
 * "Normalizes" bg units into known, expected values
 *
 * @param units
 * @returns {*}
 */
exports.normalizeBgUnits = function(units) {
  switch(units) {
    case 'mg dl':
      return 'mg/dL';
    case 'mmol l':
      return 'mmol/L';
    case 'unset':
      return null;
    default:
      return units;
  }
};

/**
 * Detects whether a settings object represents a new device
 * in the process of being set up for the first time.
 *
 * @param settings object
 */
exports.isSuspectedNewDevice = function(settings) {
  var allButEmpty = true;
  // check to see if all basal schedules are empty
  // if not return a false early
  var schedNames = Object.keys(settings.basalSchedules);
  for (var i = 0; i < schedNames.length; ++i) {
    var sched = settings.basalSchedules[schedNames[i]];
    if (!_.isEmpty(sched)) {
      return false;
    }
  }
  if (!_.isEmpty(settings.bgTarget)) {
    return false;
  }
  if (!_.isEmpty(settings.carbRatio)) {
    return false;
  }
  if (!_.isEmpty(settings.insulinSensitivity)) {
    return false;
  }
  return allButEmpty;
};

exports.isMgDL = function(units) {
  if (units === 'mg/dL') {
    return true;
  }
  else if (units === 'mmol/L') {
    return false;
  }
  else {
    throw new Error(util.format('Unknown BG units, got[%s]', units));
  }
};

// NB: in general what follows should NEVER been done in the uploader
// CareLink is, as often, as special case
// some values in the CSV are given as having original units in mmol/L
// but the only numeric values that appear have been converted to mg/dL
// so (since we do not yet have BG units display prefs in Tidepool apps)
// we need to convert back to mmol/L in order that these fields will be
// stored and displayed properly for the user
exports.convertBackToMmol = function(n) {
  var GLUCOSE_MM = 18.01559;
  var inMmol = n / GLUCOSE_MM;
  // return a value with a single significant digit
  // matching other mmol/L values found in CareLink data
  return Math.floor(inMmol * 10 + 0.5) / 10;
};

// TODO: delete after conclusion of Jaeb study
exports.mergeJaebPayloads = function(obj1, obj2) {
  if (!_.isEmpty(obj1.jaebPayload) && !_.isEmpty(obj2.jaebPayload)) {
    if (!_.isEmpty(obj1.jaebPayload.rawSeqNums) && !_.isEmpty(obj2.jaebPayload.rawSeqNums)) {
      obj1.jaebPayload.rawSeqNums = obj1.jaebPayload.rawSeqNums.concat(obj2.jaebPayload.rawSeqNums);
    }
  }
};
// TODO: end deletion