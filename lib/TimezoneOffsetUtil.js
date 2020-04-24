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
var util = require('util');

var sundial = require('sundial');

var annotate = require('./eventAnnotations');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('TimezoneOffsetUtil') : console.log;

module.exports = function(timezone, mostRecent, changes) {
  debug('BtUTC Inputs:');
  debug('Timezone', timezone);
  debug('Most recent timestamp', mostRecent);
  debug('Device time changes', changes);
  var self = this;
  self.type = 'across-the-board-timezone';

  var MS_IN_SEC = 1000, SEC_IN_MIN = 60;

  var offsetIntervals = [];
  var timezoneOffset = null;
  var clockDriftOffset = 0, conversionOffset = 0;
  var currentIndex = null;

  this.findOffsetDifferences = function(event) {
    var ROUND_TO_NEAREST = 30;
    var offsetDiff = Math.round(
      // Some timezones have offsets at the resolution of 30 or even 15 minutes,
      // so we round to the nearest 30 minutes whenever we see an offset change
      // to maintain some parallelism between our timezoneOffset value
      // and the actual timezone offsets that exist in the world.
      // We used to round to the nearest 15 minutes, but that was too low of a
      // resolution for some users' clock drift adjustments.
      sundial.dateDifference(event.change.from, event.change.to, 'minutes')/ROUND_TO_NEAREST
    ) * ROUND_TO_NEAREST;
    return {
      offsetDifference: offsetDiff,
      rawDifference: sundial.dateDifference(event.change.from, event.change.to, 'seconds') * MS_IN_SEC
    };
  };

  function adjustOffsets(event) {
    var difference = self.findOffsetDifferences(event);
    // the farthest timezones are UTC+14 and UTC-12, so max offset
    // difference is 840 + 720 = 1560
    var MAX_DIFF = 1560;
    if (Math.abs(difference.offsetDifference) <= MAX_DIFF) {
      timezoneOffset += difference.offsetDifference;
      clockDriftOffset += difference.rawDifference - difference.offsetDifference * SEC_IN_MIN * MS_IN_SEC;
    }
    else {
      conversionOffset += difference.rawDifference;
    }

    // if timezone offset is invalid, move to conversion offset until valid
    var TWENTY_FOUR_HOURS = 1440;
    var MAX_TIMEZONE_OFFSET = 840;
    var MIN_TIMEZONE_OFFSET = -720;
    while (timezoneOffset > MAX_TIMEZONE_OFFSET) {
      timezoneOffset -= TWENTY_FOUR_HOURS;
      conversionOffset += TWENTY_FOUR_HOURS * SEC_IN_MIN * MS_IN_SEC;
    }
    while (timezoneOffset < MIN_TIMEZONE_OFFSET) {
      timezoneOffset += TWENTY_FOUR_HOURS;
      conversionOffset -= TWENTY_FOUR_HOURS * SEC_IN_MIN * MS_IN_SEC;
    }
  }

  // check that an appropriate timezone is passed in
  try {
    sundial.checkTimezoneName(timezone);
  }
  catch (e) {
    throw e;
  }

  // check that an appropriate date of most recent datum is passed in
  if (isNaN(Date.parse(mostRecent))) {
    throw new Error('Invalid timestamp for most recent datum!');
  }

  // check that the changes are of the correct type if passed in
  if (!_.isEmpty(changes)) {
    _.each(changes, function(change) {
      if (!(change.subType && change.subType === 'timeChange')) {
        var error = new Error(util.format('Wrong subType of object passed as `timeChange`. Object is [%s]', JSON.stringify(change)));
        throw error;
      }
    });
    self.type = 'utc-bootstrapping';
    // now process the changes and set up the offset intervals
    var sorted = _.sortBy(changes, function(change) { return change.index; }).reverse();
    for (var i = 0; i < sorted.length; ++i) {
      var change = sorted[i];
      if (i === 0) {
        change.time = sundial.applyTimezoneAndConversionOffset(
          change.jsDate,
          timezone,
          conversionOffset
        ).toISOString();
        change.timezoneOffset = sundial.getOffsetFromZone(mostRecent, timezone);
        change.clockDriftOffset = clockDriftOffset;
        change.conversionOffset = conversionOffset;
        delete change.jsDate;
        timezoneOffset = change.timezoneOffset;
        currentIndex = change.index;
        offsetIntervals.push({
          start: change.time,
          end: mostRecent,
          startIndex: change.index,
          endIndex: null,
          timezoneOffset: change.timezoneOffset,
          clockDriftOffset: change.clockDriftOffset,
          conversionOffset: change.conversionOffset
        });
        adjustOffsets(change);
      }
      else {
        change.time = sundial.findTimeFromDeviceTimeAndOffsets(change.jsDate, timezoneOffset, conversionOffset).toISOString();
        change.timezoneOffset = timezoneOffset;
        change.clockDriftOffset = clockDriftOffset;
        change.conversionOffset = conversionOffset;
        delete change.jsDate;
        adjustOffsets(change);
        offsetIntervals.push({
          start: change.time,
          end: sorted[i - 1].time,
          startIndex: change.index,
          endIndex: currentIndex,
          timezoneOffset: change.timezoneOffset,
          clockDriftOffset: change.clockDriftOffset,
          conversionOffset: change.conversionOffset
        });
        currentIndex = change.index;
      }
      changes[i] = change.done();
    }
    var earliestSoFar = offsetIntervals[offsetIntervals.length - 1];
    offsetIntervals.push({
      start: null,
      end: earliestSoFar.start,
      startIndex: null,
      endIndex: currentIndex,
      timezoneOffset: timezoneOffset,
      clockDriftOffset: clockDriftOffset,
      conversionOffset: conversionOffset
    });
  }
  debug('Computed offset intervals', offsetIntervals);
  this.records = changes;
  this.lookup = (function() {
    if (!_.isEmpty(offsetIntervals)) {
      return function(datetime, index) {
        for (var i = 0; i < offsetIntervals.length; ++i) {
          var currentInterval = offsetIntervals[i];
          // reverse offset because we're going ~to~ UTC
          // we store offsets ~from~ UTC
          var utc = sundial.findTimeFromDeviceTimeAndOffsets(datetime, currentInterval.timezoneOffset, currentInterval.conversionOffset).toISOString();
          var retObj = {
            time: utc,
            timezoneOffset: currentInterval.timezoneOffset,
            clockDriftOffset: currentInterval.clockDriftOffset,
            conversionOffset: currentInterval.conversionOffset
          };
          if (index != null) {
            if (currentInterval.startIndex != null && currentInterval.endIndex != null) {
              if (index <= currentInterval.endIndex && index > currentInterval.startIndex) {
                return retObj;
              }
            }
            else if (currentInterval.startIndex != null) {
              if (index > currentInterval.startIndex) {
                return retObj;
              }
            }
            else if (currentInterval.endIndex != null) {
              if (index <= currentInterval.endIndex) {
                return retObj;
              }
            }
          }
          else {
            if (utc >= currentInterval.start && utc <= currentInterval.end) {
              return retObj;
            }
            else if (currentInterval.start === null && utc <= currentInterval.end) {
              return retObj;
            }
            // handles timestamps in the future
            // e.g., when a user set device time a month in the future
            else if (utc >= currentInterval.start && utc > currentInterval.end) {
              return retObj;
            }
          }
        }
      };
    }
    // default to across-the-board timezone application if no changes provided
    else {
      return function(datetime) {
        var utc = sundial.applyTimezone(datetime, timezone).toISOString();
        return {
          time: utc,
          timezoneOffset: sundial.getOffsetFromZone(utc, timezone),
          clockDriftOffset: 0,
          conversionOffset: 0
        };
      };
    }
  })();

  this.fillInUTCInfo = function(obj, jsDate) {
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Must provide an object!');
    }
    if (_.isEmpty(obj)) {
      throw new Error('Object must not be empty!');
    }
    if (isNaN(jsDate.valueOf())) {
      throw new Error('Date must be provided!');
    }
    var lookupIndex = _.get(obj, 'index', null);
    if (!(_.isFinite(obj.index) && obj.index >= 0)) {
      lookupIndex = null;
    }
    var res = this.lookup(jsDate, lookupIndex);
    if (!res) {
      debug('Could not look up UTC info for:', obj);
    } else {
      obj.time = res.time;
      obj.timezoneOffset = res.timezoneOffset;
      obj.clockDriftOffset = res.clockDriftOffset;
      obj.conversionOffset = res.conversionOffset;
      if (obj.index == null) {
        annotate.annotateEvent(obj, 'uncertain-timestamp');
      }
    }
    return obj;
  };

  return this;
};
