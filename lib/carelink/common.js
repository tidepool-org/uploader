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

var parsing = require('./parsing.js');

exports.autoGenModels = {
  'Paradigm 522': true,
  'Paradigm 722': true
};

exports.makeCommonVals = function(timezone){
  return function (line) {
    var deviceTime = sundial.formatDeviceTime(line.deviceTime);
    var time = sundial.applyTimezone(deviceTime, timezone);

    return {
      deviceTime: deviceTime,
      time: time.toISOString(),
      timezoneOffset: (line.deviceTime.valueOf() - time.valueOf()) / 60000,
      deviceId: line['Raw-Device Type'] + '-=-' + line['Raw-Upload ID']
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
 * Adds an annotation to an event.
 *
 * @param event the event
 * @param ann the opaque string code for the annotation to add, or the annotation object itself
 */
exports.annotateEvent = function(event, ann) {
  if (event.annotations == null) {
    event.annotations = [];
  }

  var annotation = typeof(ann) === 'string' ? { code: ann } : ann;
  if (! exports.isAnnotated(event, annotation)) {
    event.annotations.push(annotation);
  }

  return event;
};

/**
 * Checks if an event is annotated with the specific annotation
 *
 * @param event
 * @param ann the opaque string code for the annotation to add, or the annotation object itself
 */
exports.isAnnotated = function (event, ann) {
  if (event == null || event.annotations == null || event.annotations.length === 0) {
    return false;
  }

  var annotation = typeof(ann) === 'string' ? { code: ann } : ann;
  for (var i = 0; i < event.annotations.length; ++i) {
    if (event.annotations[i].code === annotation.code) {
      return true;
    }
  }
  return false;
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
