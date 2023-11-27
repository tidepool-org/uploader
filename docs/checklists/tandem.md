# Tandem

## Checklist for Insulin Pump Implementation

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
    - `*[-]` name of basal schedule on each scheduled basal rate interval
    - `[x]` if basal schedule is a single (flat) rate all day, pump records a new basal rate interval every midnight
  - `[ ]` manual temp basal
    - `[ ]` basal rate intervals with a start time, duration, and rate delivered
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[x]` percentage temp basal
    - `[x]` basal rate intervals with a start time, duration, percent
        - `[x]` rate provided directly OR
        - `[ ]` rate computed from percent x suppressed.rate
    - `[x]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[x]` "suspended" basals (see [status - suspends & resumes](#device-events) below)
    - `[x]` basal interval with a start time and duration but no rate (b/c suspended)
    - `*[-]` object representing suppressed scheduled basal *for each segment of the basal schedule that the suspension of insulin delivery intersects*
  - `[x]` final (most recent) basal
    - `[x]` basal rate interval with a start time, duration "guessed" from settings, rate delivered, and an annotation re: the "guessed" duration OR
    - `[ ]` basal rate interval with a start time and rate, no (= zero) duration
  - `[x]` automated basal
    - `[x]` basal rate intervals with a start time, duration, and rate delivered
    - `[x]` if closed loop mode changes during basal, two separate basal entries are created
    - `[x]` if basal rate is a single (flat) rate all day, pump records a new basal rate interval every midnight

##### Device-specific? (Add any device-specific notes/additions here.)

- we cannot add the name of the basal schedule on each scheduled basal rate interval at the moment, as that would require a full settings history
- we cannot represent suppressed scheduled basals during suspended basals at the moment, as we require a full settings history to determine them for each segment of the basal schedule that the suspended basal intersects
- manual temp basals are not implemented, as Tandem only allows for percentage temp basals

#### Boluses

  - `[x]` normal bolus
    - `[x]` amount of insulin delivered
    - `[x]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - `[x]` automated bolus
    - `[x]` amount of insulin delivered
    - `[x]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - `[x]` extended bolus
    - `[x]` amount of insulin delivered
    - `[x]` duration of insulin delivery
    - `[x]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[x]` duration of insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - `[ ]` extended bolus that crosses midnight is split into two records
  - `[x]` combo/dual bolus
    - `[x]` amount of insulin delivered - immediate (normal)
    - `[x]` amount of insulin delivered - extended
    - `[x]` duration of extended insulin delivery
    - `[x]` amount of immediate insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[x]` amount of extended insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[x]` duration of extended insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - `[ ]` extended portion of combo bolus that crosses midnight is split into two records
  - bolus cancellations/interruptions
    - `[ ]` represented by a separate event in the device's data log OR
    - `[x]` result in modifications to a bolus event in the device's data log
  - `[x]` link to "wizard"/calculator entry (via log entry ID or similar)

No Tidepool data model yet:

  - bolus cancellations/interruptions
    - `[?]` agent/reason for bolus cancellation

Device-specific? (Add any device-specific notes/additions here.)

#### CBG

(See [the CGM checklist](../../../docs/checklisttemplates/CGMChecklist.md) instead.)

#### Device Events

  - alarms:
    - `[x]` low insulin
    - `[x]` no insulin
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` low power
    - `[x]` no power
        - `[?]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` occlusion
        - `[x]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[?]` no delivery
        - `[?]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` auto-off
        - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[ ]` over limit (i.e., max bolus exceeded through override)
    - `[x]` other alarm types (details to be provided in `payload` object)
  - `[x]` prime events
    - `[x]` prime target = tubing
    - `[x]` prime target = cannula
    - `[ ]` prime targets not differentiated
    - `[x]` prime volume in units of insulin
  - `[x]` reservoir change (or reservoir rewind)
    - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
  - `[x]` status events (i.e., suspend & resume)
    - `[ ]` suspensions of insulin delivery are represented as (interval) events with a duration OR
    - `[x]` suspensions of insulin delivery are represented as pairs of point-in-time events: a suspension and a resumption
    - `[x]` reason/agent of suspension (`automatic` or `manual`)
    - `[ ]` reason/agent of resumption (`automatic` or `manual`)
  - calibrations: see [the CGM checklist](../../../docs/checklisttemplates/CGMChecklist.md) instead
  - `[x]` time changes (presence of which is also in the [BtUTC section](#bootstrapping-to-utc) below)
    - `[x]` device display time `from` (before change) and `to` (result of change)
    - `[x]` agent of change (`automatic` or `manual`)
    - `[ ]` timezone
    - `[ ]` reason for change (read from device)
  - `[x]` pump settings override
    - `[x]` override type
    - `[ ]` method = manual/automatic
    - `[x]` duration of override

##### Device-specific? (Add any device-specific notes/additions here.)

- At the moment we only process the most recent 90 days of log history, as it takes too long to get all the records from pumps with a large history. This means we also need to search for the newest relevant event to start reading from. Events like USB-connected are considered to be not relevant (since we don't process them), but we do consider events like reservoir-change events to be relevant (as they are rendered in the Basics view).
- An occlusion alarm does not trigger a basal rate change event (used to create all other basals), so a suspended basal is created manually.
- For status events reasons and causes are provided from the alarms if available, i.e., for occlusion, auto-off, no-insulin and no-power alarms. For cartridge-change alarms, the cause will show as other.
- There are no Tandem alarm or alert types that map directly to "no delivery", which is why it's not implemented.

#### SMBG

  - `[x]` blood glucose value
  - `[x]` subType (`linked` or `manual`)
  - `[ ]` units of value (read from device, not hard-coded)
  - `[ ]` out-of-range values (LO or HI)
  - `[ ]` out-of-range value thresholds (e.g., often 20 for low and 600 for high on BGMs)

No Tidepool data model yet:

  - `[ ]` meal tag (i.e., pre- or post-meal)
  - `[ ]` other/freeform tags
  - `[?]` categorization of value according to BG target(s) from settings

#### Device-specific? (Add any device-specific notes/additions here.)

- Tandem only provides BG thresholds for triggering reminders. Out-of-range/threshold info are available for CGM data.

#### Settings

  - `[x]` basal schedules
    - `[ ]` name of basal schedule OR
    - `[x]` name of settings profile
    - `[x]` each schedule as a set of objects each with a rate and a start time
  - `[x]` name of currently active basal schedule
  - `[?]` units of all blood glucose-related fields (read from device, not hard-coded)
  - `[?]` units of all carb-related fields (read from device, not hard-coded)
  - `[x]` carb ratio(s)
    - `[x]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with a ratio (amount) and a start time
  - `[x]` insulin sensitivity factor(s)
    - `[x]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with an amount and a start time
  - `[x]` blood glucose target(s)
    - `[x]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with a target and a start time
    - target shape:
        - `[ ]` shape `{low: 80, high: 120}` OR
        - `[x]` shape `{target: 100}` OR
        - `[ ]` shape `{target: 100, range: 20}` OR
        - `[ ]` shape `{target: 100, high: 120}`
  - basal features:
    - `[ ]` temp basal type (`manual` or `percentage`)
    - `[ ]` max basal (as a u/hr rate)
  - bolus features:
    - `[x]` bolus "wizard"/calculator enabled
    - `[ ]` extended boluses enabled
    - `[x]` max bolus
  - `[x]` insulin action time
  - `[ ]` display BG units
  - `[x]` automated delivery
  - `[x]` firmware version

Settings history:

  - `*[-]` device stores all changes to settings OR
  - `[ ]` device only returns current settings at time of upload

No Tidepool data model yet:

  - `[-]` low insulin alert threshold
  - auto-off:
    - `[-]` enabled
    - `[-]` threshold
  - `[ ]` language
  - reminders:
    - `[-]` BG reminder
    - `[-]` bolus reminder
  - `[-]` alert settings (volume or vibration-only; whether enabled)
  - bolus features:
    - `[ ]` bolus increment for non-"quick"/manual boluses
    - `[ ]` min BG to allow calculation of bolus delivery
    - `[ ]` reverse correction enabled
    - "quick"/manual bolus:
        - `[-]` enabled
        - `[-]` increment
  - `[ ]` clock display preference (12h vs 24h format)

##### Device-specific? (Add any device-specific notes/additions here.)

- To build a full settings history we'll need to use the entire log record, not just the last 90 days. For example, a profile name change event only contains the new name, so you'll need to read the record where it was first created to get the original name. Until we do diff uploads (so it only happens once), or significantly improve the upload speed, reading the entire log record is not possible.

#### Wizard

  - `[x]` recommended bolus dose
    - `[x]` recommendation for carbohydrates
    - `[x]` recommendation for correction (calculation from BG input)
    - net recommendation
        - `[ ]` net recommendation provided directly in data OR
        - `[x]` net recommendation is just `recommended.carb` + `recommended.correction` OR
        - `[ ]` method for calculating net recommendation documented in data spec OR
        - `[ ]` method for calculating net recommendation reverse-engineered from pump manuals/test data
  - `[x]` input blood glucose value
  - `[x]` carbohydrate input in grams
  - `[x]` insulin on board
  - `[x]` insulin-to-carb ratio
  - `[x]` insulin sensitivity factor (with units)
  - `[x]` blood glucose target
    - `[ ]` shape `{low: 80, high: 120}` OR
    - `[x]` shape `{target: 100}` OR
    - `[ ]` shape `{target: 100, range: 20}` OR
    - `[ ]` shape `{target: 100, high: 120}`
  - `[ ]` units of BG input and related fields (read from device, not hard-coded; related fields are `bgInput`, `bgTarget`, `insulinSensitivityFactor`)
  - `[x]` link to bolus delivered as a result of wizard (via log entry ID or similar)

##### Device-specific? (Add any device-specific notes/additions here.)

- Instead of a bolus calculator (or wizard), Tandem has a carbs setting enabled or not. When the carbs setting is not enabled, a manual bolus is entered. When it is enabled, a recommended bolus dose is provided.

#### "Bootstrapping" to UTC

  - `[x]` index
    - `[ ]` UTC timestamp (*Hey, one can dream!*) OR
    - `[x]` internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
    - `[ ]` ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time
  - `[x]` date & time settings changes
  - `[x]` use `common.checkDeviceTime(currentDeviceTime, timezone, cb)` to check against server time

##### Device-specific? (Add any device-specific notes/additions here.)

At the moment, we only process data from the most recent pump shut-down event, if any exist. This is because a subtle assumption of BtUTC is that the pump clock is always running. Unfortunately, when a Tandem device is shut down, the clock stops. There are several ways we might try to handle these shut-downs and still do bootstrapping, all of which reduce to finding a way to reliably identify (and then drop) `timeChange` events occurring just after a device shutdown to reset the stopped clock, but we'll need to research and potentially prototype these to figure out the best approach and then implement it.

### No Tidepool Data Model Yet

> **NB:** You can and should add to this section if there are other data types documented in the device's data protocol specification but not part of Tidepool's data model (yet).

  - `[ ]` activity/exercise
  - `[ ]` food (e.g., from a food database built into the pump)
  - `[ ]` notes/other events

### Tidepool ingestion API

Choose one of the following:

  - `[x]` legacy "jellyfish" ingestion API
  - `[ ]` platform ingestion API

### Known implementation issues/TODOs

*Use this space to describe device-specific known issues or implementation TODOs **not** contained in the above datatype-specific sections.*
