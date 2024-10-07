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
var _ = require('lodash');

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
    if (basalSched[i].rate === parseFloat(currBasal.rate.toFixed(3))) {
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

    return cb(null, serverTime);
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

Number.prototype.toFixedNumber = function(significant){
  var pow = Math.pow(10,significant);
  return +( Math.round(this*pow) / pow );
};

exports.updateDuration = function(event, lastEvent) {

  const withAnnotation = function(event) {
    if(_.find(event.annotations || [], function(ann) {
        return ann.code === 'final-basal/fabricated-from-schedule' ||
               ann.code === 'basal/unknown-duration' ||
               ann.code === 'status/incomplete-tuple' ||
               ann.code === 'bolus/extended-in-progress' ||
               ann.code === 'tandem/pumpSettingsOverride/estimated-duration';
      })) {
      return true;
    }
    return false;
  };

  let updatedDuration = Date.parse(event.time) - Date.parse(lastEvent.time);

  if (event.extended && event.duration) {
    // for extended boluses we don't have to calculate the duration
    updatedDuration = event.duration;
  }

  if (updatedDuration >= 0) {
    debug('Updating duration of last event from previous upload');
    if((lastEvent.subType !== 'pumpSettingsOverride') && lastEvent.duration > 0) {
      lastEvent.expectedDuration = lastEvent.duration;
    }
    lastEvent.duration = updatedDuration;

    if (withAnnotation(lastEvent)) {
      // if the event was previously annotated because of the missing event,
      // we can now remove the annotations
      lastEvent = _.omit(lastEvent, 'annotations');
    }

    return lastEvent;
  } else {
    return null;
  }
};

exports.strip = function(record) {
  const stripped = _.omit(record,
    'createdTime', 'id', 'modifiedTime', 'revision', 'uploadId',
    '_active', '_deduplicator', '_id', '_schemaVersion', '_userId',
  );

  debug(`Last ${stripped.type} (${stripped.subType || stripped.deliveryType}) from previous upload was: ${JSON.stringify(stripped, null, 4)}`);
  return stripped;
};

exports.updatePreviousDurations = async function(data, cfg, cb) {


  try {
    // update last basal
    const lastBasal = this.strip(await api.getLatestRecord(cfg.groupId, cfg.deviceInfo.deviceId, 'basal'));
    let datum = _.find(data.post_records, {type: 'basal'});
    if (datum != null) {
      const updatedBasal = this.updateDuration(datum, lastBasal);
      if (updatedBasal) {
        data.post_records.push(updatedBasal);
      }
    }

    // update last suspend event
    if (lastBasal.deliveryType === 'suspend') {
      const lastDeviceEvent = this.strip(await api.getLatestRecord(cfg.groupId, cfg.deviceInfo.deviceId, 'deviceEvent', 'status'));
      if (lastDeviceEvent.subType === 'status') {
        const index = _.findIndex(data.post_records, {type: 'deviceEvent', subType: 'status'});
        datum = data.post_records[index];

        if (index > -1) {
          const updatedStatus = this.updateDuration(datum, lastDeviceEvent);

          if (updatedStatus) {
            updatedStatus.reason.resumed = datum.reason.resumed;

            if (lastDeviceEvent.payload && lastDeviceEvent.payload.reason != null) {
              updatedStatus.payload.suspended = lastDeviceEvent.payload.reason;
              delete updatedStatus.payload.reason;
            }
            if (datum.payload && datum.payload.reason != null) {
              updatedStatus.payload.resumed = datum.payload.reason;
            }

            data.post_records.push(updatedStatus);
            data.post_records.splice(index, 1); // remove resume event that is now combined
          }
        }
      }
    }

    // update last pump settings override
    const lastPumpSettingsOverride = this.strip(await api.getLatestRecord(cfg.groupId, cfg.deviceInfo.deviceId, 'deviceEvent', 'pumpSettingsOverride'));

    if (annotate.isAnnotated(lastPumpSettingsOverride, 'tandem/pumpSettingsOverride/estimated-duration')) {
      datum = _.find(data.post_records, {type: 'deviceEvent', subType: 'pumpSettingsOverride'});
      if (datum != null) {
        const updatedOverride = this.updateDuration(datum, lastPumpSettingsOverride);
        if (updatedOverride) {
          data.post_records.push(updatedOverride);
        } else {
          debug('Not updating pump settings override as duration could not be calculated');
        }
      } else {
        debug('Pump settings override should still be active');
      }
    }
    return cb (null, data);
  } catch (error) {
    return cb (error);
  }
};
