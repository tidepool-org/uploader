var _ = require('./lodash.js');

var SEC_TO_MSEC = 1000;
var MIN_TO_MSEC = 60 * SEC_TO_MSEC;
var MIN30_TO_MSEC = 30 * MIN_TO_MSEC;

module.exports.SEC_TO_MSEC = SEC_TO_MSEC;
module.exports.MIN_TO_MSEC = MIN_TO_MSEC;
module.exports.MIN30_TO_MSEC = MIN30_TO_MSEC;

module.exports.buildMsec = function(o, tz_offset_minutes) {
  var t = _.pick(o, ['year', 'month', 'day', 'hours', 'minutes', 'seconds']);
  var d2 = function(x) {
    return ('x00' + x).slice(-2);
  };
  // create s because we can then fool Javascript into ignoring local time zone.
  var s = t.year + '-' + d2(t.month) + '-' + d2(t.day) + 'T' +
          d2(t.hours) + ':' + d2(t.minutes) + ':' + d2(t.seconds) + 'Z';
  var d;
  if (tz_offset_minutes) {
    // offset for times is the value you see in timestamps (-0800 for PST is -480 minutes)
    // which is what you add to get your local time from zulu time.
    // to get to zulu time we need to go the other way -- subtract, not add.
    d = Date.parse(s) - tz_offset_minutes * MIN_TO_MSEC;
  } else {
    d = Date.parse(s);
  }
  return d;
};

module.exports.mSecToISOString = function(ts, tz_offset_minutes) {
  var dt = new Date(ts).toISOString();
  if (tz_offset_minutes != null) {
    return dt;
  } else {
    return dt.slice(0, -5);  // trim off the .000Z from the end
  }
};

// constructs a UTC timestamp from the canonically-named fields in o as well
// as the time zone offset. If tz_offset_minutes is null (not 0) then the resulting
// time stamp will NOT include a time zone indicator
module.exports.buildTimestamp = function(o, tz_offset_minutes) {
  var d = buildMsec(o, tz_offset_minutes);
  if (d) {
    return mSecToISOString(d, tz_offset_minutes);
  } else {
    return null;
  }
};