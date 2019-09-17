<!-- NB: this markdown file is linked directly from a Tidepool blog post, DON'T MOVE -->

## Background

At present, no diabetes device that Tidepool knows about represents the date & time at which device events occur in either UTC time or in a way that is anchored to UTC time - i.e., providing timezone and/or offset-from-UTC information. Because we are correlating data from many different sources for each user, we rely on UTC time as the absolute scale on which to place all the time series data ingested by the Tidepool platform.

## TimezoneOffsetUtil

The module in `lib/TimezoneOffsetUtil.js` is our best effort to "bootstrap" from device local time (`deviceTime`) to true UTC from a combination of three sources of information:

- the timezone that applies to the device user's most recent data on the device (selected by the device user in the uploader UI at the time of upload)

- the timestamp of the most recent datum on the device

- the set of changes to the date & time settings on the device

In combination (because timezones and timezone offsets from UTC do not map 1:1 due to Daylight Savings Time, see [Timezone Basics](#timezone-basics) below), the timezone and most recent timestamp allow us to determine the offset from UTC (in minutes) of the most recent data on the device. We then follow the set of date & time settings changes on the device backwards from the most recent data to the earliest data on the device, adjusting the offset used to convert device local time into UTC according to the settings changes. This method produces a more accurate conversion to UTC than applying a timezone across-the-board because it properly accounts for travel across timezones, as well as doing a better job of representing the changes to and from Daylight Savings Time since this "bootstrapping" to UTC [henceforth: BtUTC] does not assume that a device user changes the device time at precisely the moment of change to or from Daylight Savings Time.

In its current version, BtUTC now keeps track of *three* offsets from UTC - a `timezoneOffset` (see [Timezone Basics](#timezone-basics) below) a `conversionOffset`, and a `clockDriftOffset`. Some date & time settings changes in a device's history factor into updates to the stored `conversionOffset` or `clockDriftOffset`, while others affect the stored `timezoneOffset`. This is to preserve the semantics of the `timezoneOffset` field to match as closely as possible to the concept of what timezone offsets actually *are*. The original version of BtUTC only stored a `timezoneOffset` because it was primarily concerned with solving only the two most common use cases for device time changes on diabetes devices:

1. changes resulting from the shift to or from Daylight Savings Time, in timezones where DST is observed
1. changes resulting from travel across timezones

These changes are interpreted appropriately as changes to the stored `timezoneOffset` on each datum.

The `conversionOffset` was introduced because it became clear through the course of testing that there is a third collection of use cases that it is equally vital for BtUTC to cover - namely, changes resulting from incorrect set up of a device, including the device being set (from the first use of the device or only for a short period at some point in the history of the device's usage) to the wrong datetime entirely, including:

1. device set to the wrong a.m. or p.m.
1. device set to the wrong day
1. device set to the wrong month
1. device set to the wrong year

The bottom two of these changes (device set to wrong month or wrong year) are only reflected in the stored `conversionOffset` on each datum. In a perfect world, BtUTC would also only adjust the `conversionOffset` (but not the `timezoneOffset`) for the top two, but it is unfortunately impossible to distinguish a settings change +/- 12 hours because of the device being set to the wrong a.m. or p.m. from travel across 12 hours worth of timezones. Similarly for when a device is set to the wrong day. The only consequence of this is that the `timezoneOffset` stored on (a subset of) a user's data will not always line up correctly with the timezone(s) the user was actually in when the data was generated. We aren't trying to infer the timezone(s) of data generation (which would not be an easy task, due to the lack of a 1:1 mapping between timezones and timezone offsets), so this is an acceptable consequence. The only timezone information we store, in fact, is the timezone selected by the user at the time of upload reflecting the timezone of the most recent data on the device about to be uploaded.

Finally, the `clockDriftOffset` was introduced to handle:

1. small changes (< 15 minutes) to the device display time, made when the user notices the device clock has "drifted" a few minutes from their phone/computer/other standard clock
1. for any change interpreted as a change to the `timezoneOffset`, the difference between the offset change rounded to the nearest thirty minutes (again, this is to preserve the semantics of the `timezoneOffset` field as far as is possible) and the raw offset change

At one point, we simply included the `clockDriftOffset` as part of the `conversionOffset` and used both `conversionOffset` and `timezoneOffset` to convert between `time` and `deviceTime`. This had several undesirable side-effects, including the fact that factoring in every small device display time change a user makes results in the appearance of a drift away from start and end times of basal rate segments on exact hour, half-hour, etc. intervals. For a more detailed discussion of the `clockDriftOffset`, see [Adjustments for "Clock Drift"](#adjustments-for-clock-drift) below.

### Usage

Each device driver - even those for devices that do not allow retrieval of date & time settings changes - should integrate `TimezoneOffsetUtil` as the common way of generating the `time`, `timezoneOffset`, `conversionOffset`, and `clockDriftOffset` fields on each datum. For example, each driver should (1) import the utility:

```JavaScript
var TZOUtil = require('lib/TimezoneOffsetUtil');
```

(2) initialize it with the information required to determine the initial `timezoneOffset` - that is, the user-selected timezone (`timezone`) and the UTC timestamp of the most recent datum from the device's history (`mostRecent`). At this time, an array of the date & time settings changes from the device's history (`changes`) should also be provided as the third argument to the constructor. If the device does not store date & time settings changes (as many/all BGMs do not), then just an empty array should be passed.

```JavaScript
cfg.tzoUtil = new TZOUtil(timezone, mostRecent, changes);
```

(3) employ the utility's `fillInUTCInfo` to fill in the `time`, `timezoneOffset`, `conversionOffset`, and `clockDriftOffset` on data that already have two pieces of time-related information attached: (a) the `deviceTime` as a string (`datum.deviceTime`) and (b) an index (`datum.index`) representing the event's position in the sequence of all events that occurred on the device, where such indices are monotonically increasing from earliest datum to latest. The `fillInUTCInfo` method expects a second argument as well - a `jsDate`, which is a JavaScript Date object resulting from parsing the device's native datetime format using `sundial.buildTimestamp` or `sundial.parseFromFormat` (usually this is the object used to produce `deviceTime` via `sundial.formatDeviceTime`, and we provide it as an additional argument to avoid re-parsing the `deviceTime`, as parsing time strings is rather expensive).

```JavaScript
_.each(data, function(datum) {
  cfg.tzoUtil.fillInUTCInfo(datum, jsDate);
});
```

Each instance of the `TimezoneOffsetUtil` keeps track of which method for generating the `time` field is being employed - either across-the-board application of a timezone (when no date & time settings changes were provided to the constructor) or "bootstrapping" to UTC. The method of `time` generation is publicly available through the `type` property on the instance (i.e., `cfg.tzoUtil.type`) and must be retrieved and provided as the `timeProcessing` field of the [upload metadata](http://developer.tidepool.io/data-model/v1/upload/).

#### Expectations for `timeChange` events

The partially built `timeChange` events composing the array of `changes` provided as the third argument to a new `TimezoneOffsetUtil` instance should have the following listed fields set through use of the uploader's [objectBuilder](https://github.com/tidepool-org/uploader/blob/master/lib/objectBuilder.js). All timestamps should be [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601 'Wikipedia: ISO 8601')-formatted, without timezone offset information - e.g., `2015-01-01T12:00:00`.

- `deviceTime` = timestamp
- `change` = an object that itself has the following fields:
    + `from` = timestamp
    + `to` = timestamp
    + `agent` = string (*optional*, can have values such as `manual` or `automatic`)
- `jsDate` = a JavaScript Date constructed from the `to` time
- `index` = an index (with an expectation that all indices be monotonically increasing with event order) for the datum that allows it to be sorted with respect to all other events on the device in the order that the events actually happened (which will *not* match `deviceTime` order in the case of date & time settings changes on the device)

The `index` does not have to be numerical. For example, in the case of Dexcom data, the `index` is the Dexcom's `internalTime`, which is monotonically increasing and never affected by adjustments to the Dexcom's date & time settings.

The array of changes does not need to be sorted before passing it into the `TimezoneOffsetUtil` constructor. The changes *will* be mutated by the `TimezoneOffsetUtil`:

- `time` will be added (the true UTC timestamp)
- `timezoneOffset` will be added
- `conversionOffset` will be added
- `clockDriftOffset` will be added
- `jsDate` will be deleted

(As a historical aside: the choice to mutate the `timeChange` events makes for a somewhat deceptive and/or opaque API, but this was felt to be a better choice than repeating the same code (effecting the mutations described above) across all the device drivers. We may change this in the future.)

The `fillInUTCInfo` method from the usage example above also mutates the object passed as its first argument, adding `time`, `timezoneOffset`, `conversionOffset`, and `clockDriftOffset` fields. An annotation may additionally be added if no `index` was provided on the object, which results in uncertainty in the determination of the correct UTC timestamp. (Some diabetes devices do not provide a monotonically increasing index on *all* events in the device history.)

### Assumptions

In this section, we outline the assumptions that `TimezoneOffsetUtil` currently makes. These may change - or may become configurable - in the future.

#### Defaulting to Across-the-Board Timezone Application

Some devices that Tidepool supports or plans to support do not provide date & time settings changes in the device data protocol; at present, all such devices Tidepool knows about are traditional fingerstick blood glucose meters. For these devices, there is no way to use the same BtUTC strategy, and so when `TimezoneOffsetUtil` is initialized with an empty array for `changes` (because there are no date & time settings changes in the device data), it *defaults* to across-the-board application of the specified timezone to convert local device time into UTC time. This means that for users who travel extensively (and change the display time on all their diabetes devices when they do so), if they view their data in a timezone-aware display (rather than a display that visualizes data according to local device time), the data from their different devices may not always be aligned properly due to some of their devices' timestamps being converted to UTC via across-the-board application of a timezone and some via BtUTC.

Even for devices from which Tidepool *is* able to extract date & time settings changes, if there are no date & time settings changes in the data extracted from the device during a particular upload session, then the across-the-board timezone application strategy will still come into play as the default. This should produce accurate UTC timestamps as long as the correct timezone is selected by the user of the device on upload.

#### Adjustments for "Clock Drift"

`TimezoneOffsetUtil` does *not* assume that every change to the date & time settings on the device should result in a change to the `timezoneOffset` stored on each datum; settings changes that do not look like timezone-related changes (i.e., plausibly to/from DST or travel across timezones) instead result in changes to the stored `conversionOffset` or `clockDriftOffset`. As described above, very large changes (wrong month, wrong year, etc.) are factored into the `conversionOffset`. On the other hand, very small changes are factored into the `clockDriftOffset`.

Diabetes devices often suffer from "clock drift," and some users are in the habit of regularly correcting this drift on their devices. "Clock drift" adjustments can also happen unintentionally due to the way that device UIs often work, allowing the user to set only the hour and minutes in the display time, such that changes the user makes will almost never be precisely *x* number of hours earlier or later, but rather *x* + some seconds. That difference of seconds will be perceived by the BtUTC code as "clock drift" adjustment. Since the correction to the drift does not represent a change to or from Daylight Savings Time or a change in timezone, it is not a change that we are particularly interested in tracking in the `timezoneOffset`, and in fact it would be detrimental to track it if we want to preserve the potential for associating timezones with the `timezoneOffset`s stored in the data. (Such association could be done via user interaction - e.g., a pop-up with the text: "You changed the time on your device here. Were you traveling? Please select a timezone from these possibilities.")

Of course, a threshold had to be chosen to decide what amount of display date & time settings change counts as "clock drift" and what amount *doesn't*. Because there are a few fractional timezones in the world with offsets at the granularity of fifteen minutes - e.g., New Zealand's Chatham Islands (timezone 'Pacific/Chatham' at UTC+12:45) - we at first chose to round all date & time settings changes to the nearest fifteen minutes for the purpose of determining changes to the `timezoneOffset`, so any change that was eight minutes or larger was interpreted as a change to the `timezoneOffset`, while any change less than eight minutes was interpreted as "clock drift" and only reflected in an adjustment to the `clockDriftOffset`. This threshold turned out to be too low; we have had problems reported by users whose data included "clock drift" date & time settings changes of greater than eight minutes. Accordingly, we now round time changes to the nearest thirty minutes for the purposes of determining the `timezoneOffset` and consider any change of less than *fifteen* minutes to constitute a "clock drift" adjustment.

 When a user adjusts the "clock drift" at the same time as making a change related to DST or travel across timezones, we factor the (rounded) value of the change into the `timezoneOffset` and the (positive or negative) remainder into the `clockDriftOffset`.

#### Clock Drift Offset Starts at Zero

Another assumption built into the current code is that the `clockDriftOffset` starts at zero for the most recent data on the device being uploaded. In reality, this is a simplifying assumption; in the vast majority of cases, there is probably a small (within seconds or minutes) difference between the user's device time and the computer time at the time of upload. If we wanted to be extraordinarily precise about the UTC timestamps stored for every datum, we would correct for this difference between device time and computer time immediately, starting with a `clockDriftOffset` equal to the difference between the two. The main thing stopping us from doing this is the fact that we don't yet have a robust enough interface for distinguishing between device time, computer time, device timezone, and computer timezone.

Put another way, what's essential for this initial release of BtUTC is that the user selects the timezone that applies to the most recent data on their device, even if that is *not* the user's current timezone (e.g., user travels from California to Florida, leaving all their diabetes devices in Pacific time but uploading from Florida; in this instance we want the user to select 'Pacific' as the timezone that applies to their most recent data and we would *not* want to correct for the 3+ hour difference between device time and computer time).

#### Upper Threshold for Timezone Offset Changes

In rare but certainly not unheard-of instances, a diabetes device user sets the time on the device to the entirely wrong month or year and later must correct it. We do not interpret such massive changes to the date & time settings on the device as an adjustment to the `timezoneOffset`. Rather, whenever the absolute value of a date & time settings change, rounded to the nearest fifteen minutes, is larger than the maximum difference possible by traveling between timezones (1560 minutes between UTC-12:00 and UTC+14:00), we apply this change (unrounded) as an adjustment to the `conversionOffset` and keep the same `timezoneOffset`.

## Timezone Basics

It is vitally important in the context of complex time-processing code like the above-described BtUTC to have a good understanding of all the relevant terms and use them precisely. So here is a small glossary, just in case these concepts are new:

### timezone

A timezone is a string naming a valid timezone from the [IANA Time Zone Database](https://www.iana.org/time-zones). Some examples are `US/Pacific` or `Pacific/Auckland`. You can see many more examples by hovering over the map on [Moment Timezone's landing page](http://momentjs.com/timezone/). In many cases a timezone does *not* map 1:1 with a timezone offset to UTC because of Daylight Savings Time. For example, the timezone `US/Eastern` has an offset to UTC of 300 (UTC is 300 minutes *ahead* of `US/Eastern`) when Daylight Savings is *not* in effect, but an offset to UTC of 240 when Daylight Savings *is* in effect.

### timezone offset

A timezone offset is an integer, positive or negative, giving the number of minutes of offset required to translate a local datetime into UTC. JavaScript Date and the [Moment Timezone](http://momentjs.com/timezone/) library specify timezone offsets *to* UTC from the local datetime, so the offsets are positive for the North American timezones, which are behind UTC time - that is, you need to *add* hours to get from local time to UTC time. In our data model, we store timezone offsets as minutes *from* UTC, so the offsets are negative for the North American timezones, reflecting the fact that you need to *subtract* hours from UTC to get the local time. While this choice goes against the grain of how timezone offsets are represented in JavaScript, it agrees with the [ISO 8601 international standard](https://en.wikipedia.org/wiki/ISO_8601) for representation of dates and times.

Overall, the relationship between the fields `deviceTime`, `time`, and `timezoneOffset` in the Tidepool data model can be generalized as follows (assuming all appropriate unit conversions have been made):

```
deviceTime = time + timezoneOffset
```

In the second version of BtUTC we are adding a `conversionOffset` to the data model to handle a wider range of use cases, and so the *new* generalization is:

```
deviceTime = time + timezoneOffset + conversionOffset
```

In the most current (and production) version of BtUTC, this generalization has *not* changed, despite the addition of the `clockDriftOffset`. Another way of putting this is to say that we store `clockDriftOffset` for data auditing and provenance *only*, at least at this point in time.

#### finding a timezone offset

If you don't have the timezone offset for a particular datum and you want to find it, you need *two* pieces of information:

1. the local timezone (name)
1. the local datetime OR the UTC time

This is because again, timezones do not map to timezone offsets 1:1, so some other anchor is needed to decide which offset associated with a named timezone to map to, when there is more than one option. Either the local datetime or the true UTC time for the datum can serve as this anchor.

The reverse is also true: timezone offsets do not map to timezones 1:1. For example, in the United States, Arizona does not participate in DST. It has a timezone offset of 420 minutes to UTC year-round, while neighboring geographical areas in the `US/Mountain` timezone (e.g., New Mexico) share the same offset when DST is *not* in effect but have an offset of 360 minutes to UTC when DST *is* in effect. So the offset of 420 is ambiguous between at least two timezones (and actually more, when you consider Canadian and South American timezones as well).

### timezone offset abbreviations

There is a set of (mostly?) three-letter codes used to abbreviate timezone + timezone offset information. For example, `PDT` refers to the `US/Pacific` timezone under Daylight Savings Time, which is an offset of 420 minutes to UTC, while `PST` refers to the same timezone when DST is not in effect (the `S` in `PST` is for "standard" time), an offset of 480 minutes to UTC. It is important to keep these abbreviations distinct from timezone names. Don't use an abbreviation where a timezone is requested, and vice versa.

### Daylight Savings Time

There is way too much history and complication on this topic to introduce it here concisely. If you don't know what Daylight Savings Time is, try [the wikipedia article](https://en.wikipedia.org/wiki/Daylight_saving_time 'Wikipedia: Daylight Savings Time') for it.

For our purposes, all that is important to understand is the following:

- DST is responsible for the lack of a 1:1 mapping between timezones and timezone offsets
- different countries around the world (and in different hemispheres!) change to and from DST at different dates and times
