/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var debug = require('bows')('CommonFunctions');
var annotate = require('./eventAnnotations');
var api = require('./core/api.js');
var rollbar =require('../app/utils/rollbar');
var isBrowser = typeof window !== 'undefined';
var moment = require('moment');

var GLUCOSE_MM = 18.01559;

/**
 * Computes the number of milliseconds after midnight on the date specified.
 *
 * @param dateTime DateTime object to figure out millis from
 * @returns {number} number of millis in current day
 */
exports.computeMillisInCurrentDay = function(e){
  var msFromMidnight = sundial.getMsFromMidnight(e.time, e.timezoneOffset);
  var fifteenMinsInMs = 15*60*1000;
  // adjustments for clock drift screw up our logic to see if a basal
  // matches a schedule, so we round to the nearest fifteen mins
  // to increase the chance of matching up with a schedule
  if (e.conversionOffset && e.conversionOffset !== 0) {
    var result = Math.round(msFromMidnight/fifteenMinsInMs)*fifteenMinsInMs;
    return result === 864e5 ? 0 : result;
  }
  return msFromMidnight;
};


/* truncate long-running flat-rate basal durations to 5 days */
exports.truncateDuration = function(basal, source) {
  var fiveDays = (5 * 1440 * sundial.MIN_TO_MSEC);
  if(basal.isAssigned('duration')) {
    if(basal.duration > fiveDays) {
      //flat-rate basal
      basal.duration = fiveDays;
      annotate.annotateEvent(basal, source + '/basal/flat-rate');
    }
  } else {
    basal.duration = 0;
    annotate.annotateEvent(basal, 'basal/unknown-duration');
  }
  return basal;
};

exports.bytes2hex = function(bytes, noGaps) {
  var message = '';
  for(var i in bytes) {
    var hex = bytes[i].toString(16).toUpperCase();
    if(hex.length === 1) {
      message += '0';
    }
    message += hex;
    if(!noGaps) {
      message += ' ';
    }
  }
  return message;
};

exports.getName = function (list, idx) {
  for (var i in list) {
    if (list[i].value === idx) {
      return list[i].name;
    }
  }
  return 'unknown';
};

exports.convertBackToMmol = function(n) {
  var inMmol = n / GLUCOSE_MM;
  // return a value with a single significant digit
  return Math.floor(inMmol * 10 + 0.5) / 10;
};

exports.convertToMgDl = function(n) {
  // return a integer value
  return Math.round(n * GLUCOSE_MM);
};

exports.finalScheduledBasal = function(currBasal, settings, source) {
  var millisInDay = sundial.getMsFromMidnight(currBasal.time, currBasal.timezoneOffset);
  var basalSched = settings.basalSchedules[currBasal.scheduleName];
  if (basalSched == null || basalSched.length === 0) {
    if (!currBasal.isAssigned('duration')) {
      currBasal.duration = 0;
      annotate.annotateEvent(currBasal, 'basal/unknown-duration');
      currBasal = currBasal.done();
    }
  }
  else {
    for (var i = basalSched.length - 1; i >= 0; --i) {
      if (basalSched[i].start <= millisInDay) {
        break;
      }
    }
    if (basalSched[i].rate === currBasal.rate) {
      annotate.annotateEvent(currBasal, 'final-basal/fabricated-from-schedule');
      currBasal.duration = (i + 1 === basalSched.length ? 864e5 - millisInDay : basalSched[i + 1].start - millisInDay);
      currBasal = currBasal.done();
    }
    else {
      if (!currBasal.isAssigned('duration')) {
        currBasal.duration = 0;
        annotate.annotateEvent(currBasal, source + '/basal/off-schedule-rate');
        annotate.annotateEvent(currBasal, 'basal/unknown-duration');
        currBasal = currBasal.done();
      }
    }
  }
  return currBasal;
};

exports.checkDeviceTime = function (cfg, cb) {
  var { timezone, displayTimeModal } = cfg;
  api.getTime(function (err, result) {
    if (err) {
      return cb(err);
    }
    var serverTime = sundial.parseFromFormat(result);
    debug('Server time:', serverTime);

    if (isBrowser && cfg.deviceInfo.deviceTime != null) {
      var deviceTime = sundial.applyTimezone(cfg.deviceInfo.deviceTime, timezone);

      debug('Device time:', deviceTime);

      var FIFTEEN_MINUTES = 15 * 60 * 1000;
      if ( Math.abs(serverTime.valueOf()-deviceTime.valueOf()) > FIFTEEN_MINUTES ) {
        if (rollbar) {
          rollbar.info('Device time not set correctly or wrong timezone selected');
        }
        displayTimeModal(function (error) {
          if (error === 'deviceTimePromptClose' && rollbar) {
            rollbar.info('Upload cancelled after wrong device time warning');
          }
          return cb(error, serverTime);
        }, cfg, {serverTime, deviceTime});
        return;
      }
    } else {
      debug('Current device time not provided by driver.');
    }

    return cb(null);
  });
};

exports.addDurationToDeviceTime = function (event, duration) {
  /*
     Since deviceTime's timezone is represented separately in timezoneOffset,
     we cannot use the Date constructor (and its equivalent Date.parse) for
     parsing deviceTime strings, so we use sundial.applyOffset instead.

     Returns Date() object
  */
  return sundial.applyOffset(new Date(sundial.applyOffset(event.deviceTime, -event.timezoneOffset).valueOf() + duration), event.timezoneOffset);
};

exports.fixFloatingPoint = (n) => Math.floor(n * 100 + 0.5) / 100;
