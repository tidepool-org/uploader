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

var annotate = require('./eventAnnotations');


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
      annotate.annotateEvent(currBasal, source + '/basal/fabricated-from-schedule');
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
