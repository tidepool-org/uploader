## Checklist for Microtech Equil

(Key:

 - `[x]` available in data protocol/documented in spec and implemented
 - `[-]` available in data protocol/documented in spec but *not* yet implemented
 - `[?]` unknown whether available in data protocol/documented in spec; *not* yet implemented
 - `*[ ]` TODO: needs implementation!
 - `[ ]` unavailable in data protocol and/or not documented in spec and not yet implemented)

### Required if Present

#### Basals

  - `[x]` scheduled basal
    - `[x]` basal rate intervals with a start time, duration, and rate delivered
    - `[x]` name of basal schedule on each scheduled basal rate interval
    - `[-]` if basal schedule is a single (flat) rate all day, pump records a new basal rate interval every midnight
  - `[-]` manual temp basal
    - `[-]` basal rate intervals with a start time, duration, and rate delivered
    - `[-]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[x]` "suspended" basals (see [status - suspends & resumes](#device-events) below)
    - `[x]` basal interval with a start time and duration but no rate (b/c suspended)
    - `[-]` object representing suppressed scheduled basal *for each segment of the basal schedule that the suspension of insulin delivery intersects*

Device-specific? (Add any device-specific notes/additions here.)

#### Boluses

  - `[x]` normal bolus
    - `[x]` amount of insulin delivered
    - `[x]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - `[x]` extended bolus
    - `[x]` amount of insulin delivered
    - `[x]` duration of insulin delivery
    - `[x]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[x]` duration of insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - `[-]` extended bolus that crosses midnight is split into two records
  - `[x]` combo/dual bolus
    - `[x]` amount of insulin delivered - immediate (normal)
    - `[x]` amount of insulin delivered - extended
    - `[x]` duration of extended insulin delivery
    - `[x]` amount of immediate insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[x]` amount of extended insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[x]` duration of extended insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - `[-]` extended portion of combo bolus that crosses midnight is split into two records
  - bolus cancellations/interruptions
    - `[-]` represented by a separate event in the device's data log OR
    - `[-]` result in modifications to a bolus event in the device's data log
  - `[-]` link to "wizard"/calculator entry (via log entry ID or similar)

#### Device Events

  - alarms:
    - `[x]` low insulin
    - `[x]` no insulin
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` low power
    - `[x]` no power
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` occlusion
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[ ]` no delivery
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` auto-off
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[ ]` over limit (i.e., max bolus exceeded through override)
    - `[ ]` other alarm types (details to be provided in `payload` object)
  - `[x]` prime events
    - `[ ]` prime target = tubing
    - `[x]` prime target = cannula
    - `[ ]` prime targets not differentiated
    - `[ ]` prime volume in units of insulin
  - `[x]` reservoir change (or reservoir rewind)
    - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
  - `[x]` status events (i.e., suspend & resume)
    - `[x]` suspensions of insulin delivery are represented as (interval) events with a duration OR
    - `[ ]` suspensions of insulin delivery are represented as pairs of point-in-time events: a suspension and a resumption
    - `[ ]` reason/agent of suspension (`automatic` or `manual`)
    - `[ ]` reason/agent of resumption (`automatic` or `manual`)
  - calibrations: see [the CGM checklist](../../../docs/checklisttemplates/CGMChecklist.md) instead
  - `[-]` time changes (presence of which is also in the [BtUTC section](#bootstrapping-to-utc) below)
    - `[ ]` device display time `from` (before change) and `to` (result of change)
    - `[ ]` agent of change (`automatic` or `manual`)
    - `[ ]` timezone
    - `[ ]` reason for change (read from device)

#### SMBG

  - `[x]` blood glucose value
  - `[x]` subType (`linked` or `manual`)
  - `[x]` units of value (read from device, not hard-coded)
  - `[-]` out-of-range values (LO or HI)
  - `[-]` out-of-range value thresholds (e.g., often 20 for low and 600 for high on BGMs)

#### Settings

  - `[x]` basal schedules
    - `[x]` name of basal schedule OR
    - `[ ]` name of settings profile
    - `[x]` each schedule as a set of objects each with a rate and a start time
  - `[x]` name of currently active basal schedule
  - `[-]` units of all blood glucose-related fields (read from device, not hard-coded)
  - `[-]` units of all carb-related fields (read from device, not hard-coded)
  - `[x]` carb ratio(s)
    - `[-]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with a ratio (amount) and a start time
  - `[x]` insulin sensitivity factor(s)
    - `[ ]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with an amount and a start time
  - `[x]` blood glucose target(s)
    - `[ ]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with a target and a start time
    - target shape:
        - `[x]` shape `{low: 80, high: 120}` OR
        - `[ ]` shape `{target: 100}` OR
        - `[ ]` shape `{target: 100, range: 20}` OR
        - `[ ]` shape `{target: 100, high: 120}`
  - basal features:
    - `[ ]` temp basal type (`manual` or `percentage`)
    - `[ ]` max basal (as a u/hr rate)
  - bolus features:
    - `[ ]` bolus "wizard"/calculator enabled
    - `[x]` extended boluses enabled
    - `[ ]` max bolus
  - `[ ]` insulin action time
  - `[x]` display BG units

Settings history:

  - `[ ]` device stores all changes to settings OR
  - `[x]` device only returns current settings at time of upload

#### "Bootstrapping" to UTC

  - `[x]` index
    - `[ ]` UTC timestamp (*Hey, one can dream!*) OR
    - `[x]` internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
    - `[ ]` ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time
  - `[x]` date & time settings changes
  - `[x]` use `common.checkDeviceTime(currentDeviceTime, timezone, cb)` to check against server time

Device-specific? (Add any device-specific notes/additions here.)

### Tidepool ingestion API

Choose one of the following:

  - `[ ]` legacy "jellyfish" ingestion API
  - `[x]` platform ingestion API
