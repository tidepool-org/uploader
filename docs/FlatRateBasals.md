## Flat-Rate Basals

### The Problem

Most - if not all - diabetes manufacturers represent basal rate insulin data with _basal rate change_ events (see [Terminology](#terminology) below) rather than _basal rate intervals_. In the particular case where the user of an insulin pump has programmed a _flat-rate basal schedule_, this means that flat-rate basal rate change events are represented in one of two ways:

1. The pump records a basal rate change event every midnight (local device time) when the basal schedule (with its single segment) takes effect, as well as at any other times when the basal rate has changed such as upon the conclusion of a temp basal or on resumption from a suspend event.

1. The pump records a basal rate change event only when the basal rate has actually _changed_, which means only: on first initialization of the schedule and after any temp basals or resumption from a suspend event.

The second representation - only recording basal rate change events when the insulin delivery rate has truly changed - unfortunately poses quite a challenge for any data processing (such as ours at Tidepool) attempting to transform _basal rate change events_ (point-in-time data) to _basal rate segments_ (interval data). The issue is that when determining the duration of a basal rate segment from the user's current settings (as is necessary for the final basal segment in any upload), our general strategy is to only extend the duration of the final segment up to the maximum based on the final basal's matched segment in the schedule - no greater than twenty-four hours on a normal (i.e., not affected by DST) day. If a user has a flat-rate basal, this means we may fail to extend basal data up until the time of upload (if the last rate change was several days prior to upload). In this case, the user will appear to be missing basal data for the most recent day(s) in their upload. One potential solution to this problem is to "simulate" basal rate change events at midnight as an aid to producing the correct basal rate segments representing the scheduled delivery for each day. If this strategy is employed, the segments resulting from such fabrication should be given an annotation to record that they are fabricated events.

### Terminology

**basal rate change**: A basal rate change event is a point-in-time data type. It consists of a _rate_ (insulin delivery in units of insulin per hour) and a timestamp.

**basal (rate) segment**: A basal (rate) segment is an interval data type. It consists of a _rate_ (insulin delivery in units of insulin per hour), and either a pair of _start_ and _end_ timestamps or a _start_ timestamp and a _duration_.

**basal schedule**: A set of basal rate segments that is programmed into an insulin pump. Each basal schedule represents the basal rate(s) (in units of insulin per hour) to be delivered at different times in a standard twenty-four hour day. Thus, each segment of the schedule consists of a _rate_ and a _start_. The latter is represented as milliseconds from midnight. The first segment of every basal schedule will have a _start_ of 0 (representing midnight). When there is more than one segment in the schedule, the duration of each segment is determined by subtracting the start of the segment in question from the start of the following segment. If there is only one segment in the schedule, it's duration is (normally) 86,400,000 milliseconds (twenty-four hours), but it could be 90,000,000 or 82,800,000 on a (theoretical) device that is timezone-aware and set to a timezone that observes Daylight Savings Time.

(NB: Various manufacturers use different terms for this - e.g., basal profile. We have chosen basal schedule as our standard term.)

**flat-rate basal (schedule)**: A flat-rate basal (or more precisely a flat-rate basal _schedule_) is a basal schedule that consists in only _one_ basal rate segment that operates all twenty-four hours of a normal day.