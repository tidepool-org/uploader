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
var moment = require('moment-timezone');

var SEC_TO_MSEC = 1000;
var MIN_TO_MSEC = 60 * SEC_TO_MSEC;
var MIN30_TO_MSEC = 30 * MIN_TO_MSEC;

module.exports.SEC_TO_MSEC = SEC_TO_MSEC;
module.exports.MIN_TO_MSEC = MIN_TO_MSEC;
module.exports.MIN30_TO_MSEC = MIN30_TO_MSEC;

module.exports.buildMsec = function(o, timezone) {
  var t = _.pick(o, ['year', 'month', 'day', 'hours', 'minutes', 'seconds']);
  var d2 = function(x) {
    return ('x00' + x).slice(-2);
  };
  // create s because we can then fool Javascript into ignoring local time zone.
  var s = t.year + '-' + d2(t.month) + '-' + d2(t.day) + 'T' +
          d2(t.hours) + ':' + d2(t.minutes) + ':' + d2(t.seconds) + 'Z';
  var d;
  if (timezone) {
    // offset for times is the value you see in timestamps (-0800 for PST is -480 minutes)
    // which is what you add to get your local time from zulu time.
    // to get to zulu time we need to go the other way -- subtract, not add.
    d = moment.tz(s, timezone).valueOf();
  } else {
    d = Date.parse(s);
  }
  return d;
};

module.exports.mSecToISOString = function(ts, timezone) {
  var dt = moment(ts).toISOString();
  if (timezone != null) {
    return dt;
  } else {
    return dt.slice(0, -5);  // trim off the .000Z from the end
  }
};

// constructs a UTC timestamp from the canonically-named fields in o as well
// as the time zone offset. If tz_offset_minutes is null (not 0) then the resulting
// time stamp will NOT include a time zone indicator
module.exports.buildTimestamp = function(o, timezone) {
  var d = module.exports.buildMsec(o, timezone);
  if (d) {
    return module.exports.mSecToISOString(d, timezone);
  } else {
    return null;
  }
};

module.exports.computeTimezoneOffset = function(deviceTime, ts) {
  return (moment.utc(deviceTime).valueOf() - moment.utc(ts).valueOf()) / 60000;
};