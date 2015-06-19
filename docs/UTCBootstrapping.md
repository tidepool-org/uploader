## Background

At present, no diabetes device that Tidepool knows about represents the date & time at which device events occur in either UTC time or in a way that is anchored to UTC time - i.e., providing timezone and/or offset-from-UTC information. Because we are correlating data from many different sources for each user, we rely on UTC time as the absolute scale on which to place all the time series data ingested by the Tidepool platform.

## TimezoneOffsetUtil

The module in `lib/TimezoneOffsetUtil.js` is our best effort to "bootstrap" from device local time (`deviceTime`) to true UTC from a combination of three sources of information:

- the timezone that applies to the device user's most recent data on the device (selected via the uploader UI at the time of upload)

- the timestamp of the most recent datum on the device

- the set of changes to the date & time settings on the device

The timezone and most recent timestamp, in combination (because timezones and timezone offsets from UTC do not map 1:1 due to Daylight Savings Time), allow us to determine the offset from UTC (in minutes) of the most recent data on the device. We then follow the set of date & time settings changes on the device backwards from the most recent data to the earliest data on the device, adjusting the offset used to convert device local time into UTC according to the settings changes. This method produces a more accurate conversion to UTC than applying a timezone across-the-board because it properly accounts for travel across timezones, as well as doing a better job of representing the changes to and from Daylight Savings Time since UTC "bootstrapping" does not assume that a device user changes the device time at precisely the moment of change to or from Daylight Savings Time.

### Usage

Each device driver - even those for devices that do not allow retrieval of date & time settings changes - should integrate `TimezoneOffsetUtil` as the common way of generating the `time` and `timezoneOffset` fields on each datum. For example:

```
var TZOUtil = require('lib/TimezoneOffsetUtil');

// where mostRecent is the UTC timestamp of the most recent datum
// in the data and changes is an array of deviceMeta subType timeChange
// objects partially built (i.e., without time and timezoneOffset)
cfg.tzoUtil = new TZOUtil('US/Pacific', mostRecent, changes);

// each datum should already have a jsDate, the JavaScript Date object
// resulting from parsing the device's native datetime format using
// sundial.buildTimestamp or sundial.parseFromFormat
// the device local time should also be attached to the datum as deviceTime
// and each datum should have an index representing the event's position
// in the sequence of all events that occurred on the device
// where such indices are monotonically increasing from earliest datum to latest
_.each(data, function(datum) {
  cfg.tzoUtil.fillInUTCInfo(datum, jsDate);
});
```

### Assumptions

In this section, we outline the assumptions that `TimezoneOffsetUtil` currently makes. These may change - or may become configurable - in the future.

#### Defaulting to Across-the-Board Timezone Application

Some devices that Tidepool supports or plans to support do not provide date & time settings changes in the device data protocol; at present, all such devices Tidepool knows about are traditional fingerstick blood glucose meters. For these devices, there is no way to use the same strategy of "bootstrapping" to true UTC time, and so when `TimezoneOffsetUtil` is initialized with an empty array for `changes` (the set of date & time settings changes in the device data), it *defaults* to across-the-board application of the specified timezone to convert local device time into UTC time. This means that for users who travel extensively (and change the display time on their diabetes devices when they do so), if they view their data in a timezone-aware display (rather than a display that visualizes data according to local device time), the data from their different devices may not always be aligned properly due to some of their devices' timestamps being converted to UTC via across-the-board application of a timezone and some via UTC "bootstrapping."

An important consequence of this default behavior is that even for devices from which Tidepool *is* able to extract date & time settings changes, if there are no date & time settings changes in the data extracted from the device during a particular upload session, then the across-the-board timezone application strategy will still come into play as the default. It may be that in the future we will want to change this behavior or make it configurable, as it may not be desirable.

#### Adjustments for "Clock Drift"

`TimezoneOffsetUtil` does *not* assume that every change to the date & time settings on the device should result in a change to the offset used to convert device local timestamps to UTC timestamps. Diabetes devices often suffer from "clock drift," and some users are in the habit of regularly correcting this drift on their devices. Since the correction to the drift does not represent a change to or from Daylight Savings Time or a change in timezone, it is not a change that we are particularly interested in tracking, and in fact it would be detrimental to track it if we want to preserve the potential for associating timezones with the offsets used to convert to UTC time. (Such association could be done via user interaction - e.g., "You changed the time on your device here. Were you travelling? Please select a timezone from these possibilities.")

Of course, a threshold had to be chosen to decide what amount of display date & time settings change counts as "clock drift" and what amount *doesn't*. Because there are a few fractional timezones in the world with offsets at the granularity of fifteen minutes - e.g., New Zealand's Chatham Islands (timezone 'Pacific/Chatham' at UTC+12:45) - we have chosen to round all date & time settings changes to the nearest fifteen minutes, so any change that is eight minutes or larger will be interpreted as an offset change, while any change less than eight minutes will be interpreted as "clock drift" and not used to adjust the offset used to convert form device time to UTC.

#### Upper Threshold for Timezone Offset Changes

In rare but certain not unheard-of instances, a diabetes device user sets the time on the device to the entirely wrong month or year and later must correct it. We do not interpret such massive changes to the date & time settings on the device as an adjustment to the offset used to convert device local time into UTC; rather, whenever the absolute value of a date & time settings change, rounded to the nearest fifteen minutes, is larger than the maximum difference possible by travelling between timezones (1560 minutes between UTC-12:00 and UTC+14:00), we discard it and keep the same offset for conversion from device local time to UTC.