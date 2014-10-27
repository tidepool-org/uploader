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

var sundial = require('sundial');

var parsing = require('./parsing.js');

exports.makeCommonVals = function(timezone){
  return function (line) {
    var deviceTime = line.deviceTime.format('YYYY-MM-DDTHH:mm:ss');
    var time = sundial.parse(deviceTime, timezone);

    return {
      deviceTime: deviceTime,
      time: time.toISOString(),
      timezoneOffset: (line.deviceTime.valueOf() - time.valueOf()) / 60000,
      deviceId: line['Raw-Device Type']
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
