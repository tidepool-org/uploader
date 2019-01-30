# Animas Ping and Vibe

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
    - `[ ]` name of basal schedule on each scheduled basal rate interval
    - `[ ]` if basal schedule is a single (flat) rate all day, pump records a new basal rate interval every midnight
  - `[x]` manual temp basal
    - `[x]` basal rate intervals with a start time, duration, and rate delivered
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[ ]` percentage temp basal
    - `[ ]` basal rate intervals with a start time, duration, percent
        - `[ ]` rate provided directly OR
        - `[ ]` rate computed from percent x suppressed.rate
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[x]` "suspended" basals (see [status - suspends & resumes](#device-events) below)
    - `[x]` basal interval with a start time and duration but no rate (b/c suspended)
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the suspension of insulin delivery intersects*
  - `[x]` final (most recent) basal
    - `[ ]` basal rate interval with a start time, duration "guessed" from settings, rate delivered, and an annotation re: the "guessed" duration OR
    - `[x]` basal rate interval with a start time and rate, no (= zero) duration

Device-specific? (Add any device-specific notes/additions here.)

- Flat-rate basals are terminated after five days.
- To calculate percentages for temp basals, you need to know the active basal schedule at the time. It's not enough to look at the previous or next basal, as those may be zero/suspended. The Animas data model does not tell us which scheduled basal is being suppressed, and also does not provide a history of active basal schedules.
- A basal is categorized as suspended basal if its rate is zero and its start falls within a suspend/resume event. As only the 30 most recent suspend/resume events are stored, we can't be sure if older basals with zero rate are suspends or not.
- As the device needs to be suspended before uploading, we always have the final (most recent) basal and its duration.

#### Boluses

  - `[x]` normal bolus
    - `[x]` amount of insulin delivered
    - `[x]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - `[ ]` extended bolus
    - `[ ]` amount of insulin delivered
    - `[ ]` duration of insulin delivery
    - `[ ]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[ ]` duration of insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - `[ ]` extended bolus that crosses midnight is split into two records
  - `[x]` combo/dual bolus
    - `[ ]` amount of insulin delivered - immediate (normal)
    - `[ ]` amount of insulin delivered - extended
    - `[x]` duration of extended insulin delivery
    - `[ ]` amount of immediate insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[ ]` amount of extended insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[ ]` duration of extended insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - `*[?]` extended portion of combo bolus that crosses midnight is split into two records
  - bolus cancellations/interruptions
    - `[ ]` represented by a separate event in the device's data log OR
    - `[x]` result in modifications to a bolus event in the device's data log
  - `[x]` link to "wizard"/calculator entry (via log entry ID or similar)

No Tidepool data model yet:

  - bolus cancellations/interruptions
    - `[-]` agent/reason for bolus cancellation

Device-specific? (Add any device-specific notes/additions here.)
- With combo boluses only the total amount delivered is available. As such, all immediate and extended portions will appear with a 50:50 split.
- When a combo bolus is cancelled, we also show the total amount delivered as a 50:50 split between immediate and extended portions, since the individual amounts are not provided.
- If a combo bolus is cancelled, we don't know the actual duration, so it is set to zero and annotated with  `animas/bolus/unknown-duration`
- Animas provides bolus delivered amounts with three or more digits precision, but rounds it to the nearest 0.05 in their UI

#### CBG

(See [the CGM checklist](../../../docs/checklisttemplates/CGMChecklist.md) instead.)

#### Device Events

  - alarms:
    - `[x]` low insulin
    - `[x]` no insulin
        - `[x]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` low power
    - `[x]` no power
        - `[x]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]` occlusion
        - `[x]` needed to infer a suspend (stoppage of all insulin delivery)
    - `*[-]` no delivery
        - `*[-]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[x]]` auto-off
        - `[x]` needed to infer a suspend (stoppage of all insulin delivery)
    - `[ ]` over limit (i.e., max bolus exceeded through override)
    - `[x]` other alarm types (details to be provided in `payload` object)
  - `[x]` prime events
    - `[x]` prime target = tubing
    - `[x]` prime target = cannula
    - `[ ]` prime targets not differentiated
    - `[x]` prime volume in units of insulin
  - `[ ]` reservoir change (or reservoir rewind)
    - `[ ]` needed to infer a suspend (stoppage of all insulin delivery)
  - `[x]` status events (i.e., suspend & resume)
    - `[ ]` suspensions of insulin delivery are represented as (interval) events with a duration OR
    - `[x]` suspensions of insulin delivery are represented as pairs of point-in-time events: a suspension and a resumption
    - `[x]` reason/agent of suspension (`automatic` or `manual`)
    - `[x]` reason/agent of resumption (`automatic` or `manual`)
  - calibrations: see [the CGM checklist](../../../docs/checklisttemplates/CGMChecklist.md) instead
  - `[ ]` time changes (presence of which is also in the [BtUTC section](#bootstrapping-to-utc) below)
    - `[ ]` device display time `from` (before change) and `to` (result of change)
    - `[ ]` agent of change (`automatic` or `manual`)
    - `[ ]` timezone
    - `[ ]` reason for change (read from device)

Device-specific? (Add any device-specific notes/additions here.)

- Animas does not generate suspend/resume events for alarms, so we check if an alarm occurred recently or at the same time. If so, we mark the basal as suspended and generate a new suspend event.
- Animas only provides data on prime events (tubing/cannula), each with a specified delivered amount. It's possible to change tubing or prime without changing the reservoir. As such we cannot determine when reservoir changes/rewinds happen.
- Animas does not provide time change events, which means UTC bootstrapping is not possible

#### SMBG

  - `[x]` blood glucose value
  - `[x]` subType (`linked` or `manual`)
  - `[x]` units of value (read from device, not hard-coded)
  - `[ ]` out-of-range values (LO or HI)
  - `[ ]` out-of-range value thresholds (e.g., often 20 for low and 600 for high on BGMs)

No Tidepool data model yet:

  - `[-]` meal tag (i.e., pre- or post-meal)
  - `[-]` other/freeform tags
  - `[ ]` categorization of value according to BG target(s) from settings

Device-specific? (Add any device-specific notes/additions here.)

- Glucose values from meter as are always in mg/dL, as the field used only accepts values 0-1023.

#### Settings

  - `[x]` basal schedules
    - `*[-]` name of basal schedule OR
    - `[ ]` name of settings profile
    - `[x]` each schedule as a set of objects each with a rate and a start time
  - `[x]` name of currently active basal schedule
  - `[x]` units of all blood glucose-related fields (read from device, not hard-coded)
  - `[ ]` units of all carb-related fields (read from device, not hard-coded)
  - `[x]` carb ratio(s)
    - `[ ]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with a ratio (amount) and a start time
  - `[x]` insulin sensitivity factor(s)
    - `[ ]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with an amount and a start time
  - `[x]` blood glucose target(s)
    - `[ ]` name of settings profile
    - `[x]` (one or more) set(s) of objects each with a target and a start time
    - target shape:
        - `[ ]` shape `{low: 80, high: 120}` OR
        - `[ ]` shape `{target: 100}` OR
        - `[x]` shape `{target: 100, range: 20}` OR
        - `[ ]` shape `{target: 100, high: 120}`
    - basal features:
      - `[ ]` temp basal type (`manual` or `percentage`)
      - `[x]` max basal (as a u/hr rate)
    - bolus features:
      - `[x]` bolus "wizard"/calculator enabled
      - `[x]` extended boluses enabled
      - `[x]` max bolus
    - `[x]` insulin action time
    - `[x]` display BG units
Settings history:

  - `[ ]` device stores all changes to settings OR
  - `[x]` device only returns current settings at time of upload

No Tidepool data model yet:

  - `[-]` low insulin alert threshold
  - auto-off:
    - `[-]` enabled
    - `[-]` threshold
  - `[-]` language
  - reminders:
    - `[-]` BG reminder
    - `[-]` bolus reminder
  - `[-]` alert settings (volume or vibration-only; whether enabled)
  - bolus features:
    - `[-]` bolus increment for non-"quick"/manual boluses
    - `[ ]` min BG to allow calculation of bolus delivery
    - `[?]` reverse correction enabled
    - "quick"/manual bolus:
        - `[-]` enabled
        - `[-]` increment
  - `[-]` clock display preference (12h vs 24h format)

Device-specific? (Add any device-specific notes/additions here.)

The Animas pumps also have settings for:

  - `[-]` bolus delivery speed
  - `[-]` number of basal schedules enabled in pump GUI
  - `[-]` max total daily dose
  - `[-]` max 2-hr limit (only for some pumps)
  - `[-]` occlusion sensitivity level (NB: possibly other pumps have this setting too, in which case we should consider promoting it to a common setting even if we don't have a data model for it yet - research needed!)

Some settings are available in *both* mg/dL and mmol/L; we'll have to decide which to read and upload. One may be better than the other if it's clear that the device is using one as the original and then converting to the other.

#### Wizard

  - `[x]` recommended bolus dose
    - `[x]` recommendation for carbohydrates
    - `[x]` recommendation for correction (calculation from BG input)
    - net recommendation
        - `[ ]` net recommendation provided directly in data OR
        - `[ ]` net recommendation is just `recommended.carb` + `recommended.correction` OR
        - `[ ]` method for calculating net recommendation documented in data spec OR
        - `[x]` method for calculating net recommendation reverse-engineered from pump manuals/test data
  - `[x]` input blood glucose value
  - `[x]` carbohydrate input in grams
  - `[x]` insulin on board
  - `[x]` insulin-to-carb ratio
  - `[x]` insulin sensitivity factor (with units)
  - `[x]` blood glucose target
    - `[ ]` shape `{low: 80, high: 120}` OR
    - `[ ]` shape `{target: 100}` OR
    - `[x]` shape `{target: 100, range: 20}` OR
    - `[ ]` shape `{target: 100, high: 120}`
  - `[x]` units of BG input and related fields (read from device, not hard-coded; related fields are `bgInput`, `bgTarget`, `insulinSensitivityFactor`)
  - `[x]` link to bolus delivered as a result of wizard (via log entry ID or similar)

Device-specific? (Add any device-specific notes/additions here.)

#### "Bootstrapping" to UTC

  - `[ ]` index
    - `[ ]` UTC timestamp (*Hey, one can dream!*) OR
    - `[ ]` internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
    - `[ ]` ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time
  - `[ ]` date & time settings changes
  - `[x]` use `common.checkDeviceTime(currentDeviceTime, timezone, cb)` to check against server time

Device-specific? (Add any device-specific notes/additions here.)

- Animas does not provide time change events, which means UTC bootstrapping is not possible. Log indexes are ephemeral and specific to a record type.

### No Tidepool Data Model Yet

> **NB:** You can and should add to this section if there are other data types documented in the device's data protocol specification but not part of Tidepool's data model (yet).

  - `[ ]` activity/exercise
  - `[-]` food (e.g., from a food database built into the pump)
  - `[ ]` notes/other events

### Tidepool ingestion API

Choose one of the following:

  - `[ ]` legacy "jellyfish" ingestion API
  - `[x]` platform ingestion API

### Known implementation issues/TODOs

*Use this space to describe device-specific known issues or implementation TODOs **not** contained in the above datatype-specific sections.*
