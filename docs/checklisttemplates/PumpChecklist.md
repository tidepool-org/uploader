## Checklist for Insulin Pump Implementation

### Basals

  - [ ] scheduled basal
    - [ ] basal rate intervals with a start time, duration, and rate delivered
    - [ ] name of basal schedule as part of each scheduled basal record
    - [ ] if basal schedule is a single (flat) rate all day, pump records a new basal rate interval every midnight
  - [ ] manual temp basal
    - [ ] basal rate intervals with a start time, duration, and rate delivered
    - [ ] object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - [ ] percentage temp basal
    - [ ] basal rate intervals with a start time, duration, percent
        - [ ] rate provided directly OR
        - [ ] rate computed from percent x suppressed.rate
    - [ ] object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - [ ] automated basal
    - [ ] basal rate intervals with a start time, duration, and rate delivered
    - [ ] if closed loop mode changes during basal, two separate basal entries are created
    - [ ] if basal rate is a single (flat) rate all day, pump records a new basal rate interval every midnight
  - [ ] "suspended" basals (see [status - suspends & resumes](#device-events) below)
    - [ ] basal interval with a start time and duration but no rate (because suspended)
    - [ ] object representing suppressed scheduled basal *for each segment of the basal schedule that the suspension of insulin delivery intersects*
  - [ ] final (most recent) basal
    - [ ] basal rate interval with a start time, duration "guessed" from settings, rate delivered, and an annotation re: the "guessed" duration OR
    - [ ] basal rate interval with a start time and rate, no (= zero) duration (to be updated when available)

Device-specific? (Add any device-specific notes/additions here.)

### Boluses

  - [ ] normal bolus
    - [ ] amount of insulin delivered
    - [ ] amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - [ ] automated bolus
    - [ ] amount of insulin delivered
    - [ ] amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - [ ] extended bolus
    - [ ] amount of insulin delivered
    - [ ] duration of insulin delivery
    - [ ] amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - [ ] duration of insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - [ ] extended bolus that crosses midnight is split into two records
  - [ ] combo/dual bolus
    - [ ] amount of insulin delivered - immediate (normal)
    - [ ] amount of insulin delivered - extended
    - [ ] duration of extended insulin delivery
    - [ ] amount of immediate insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - [ ] amount of extended insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - [ ] duration of extended insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
    - [ ] extended portion of combo bolus that crosses midnight is split into two records
  - bolus cancellations/interruptions
    - [ ] represented by a separate event in the device's data log OR
    - [ ] result in modifications to a bolus event in the device's data log
  - [ ] link to bolus wizard/calculator entry (via log entry ID or similar)

Device-specific? (Add any device-specific notes/additions here.)

### CGM

(See [the CGM checklist](CGMChecklist.md) instead.)

### Device Events

  - alarms:
    - [ ] low insulin
    - [ ] no insulin
        - [ ] associated suspended status event (stoppage of all insulin delivery)
    - [ ] low power
    - [ ] no power
        - [ ] associated suspended status event (stoppage of all insulin delivery)
    - [ ] occlusion
        - [ ] associated suspended status event (stoppage of all insulin delivery)
    - [ ] no delivery
        - [ ] associated suspended status event (stoppage of all insulin delivery)
    - [ ] auto-off
        - [ ] associated suspended status event (stoppage of all insulin delivery)
    - [ ] over limit (i.e., max bolus exceeded through override)
    - [ ] other alarm types (details can be provided in `payload` object)
  - [ ] prime events
    - [ ] prime target = tubing
    - [ ] prime target = cannula
    - [ ] prime targets not differentiated
    - [ ] prime volume in units of insulin
  - [ ] reservoir change (or reservoir rewind)
    - [ ] associated suspended status event (stoppage of all insulin delivery)
  - [ ] status events (i.e., suspend & resume)
    - [ ] suspensions of insulin delivery are represented as (interval) events with a duration OR
    - [ ] suspensions of insulin delivery are represented as pairs of point-in-time events: a suspension and a resumption
    - [ ] reason/agent of suspension (`automatic` or `manual`)[^1], 
    - [ ] reason/agent of resumption (`automatic` or `manual`)
  - calibrations: see [the CGM checklist](CGMChecklist.md) instead
  - [ ] time changes
    - [ ] device display time `from` (before change) and `to` (result of change)
    - [ ] agent of change (`automatic` or `manual`)
    - [ ] timezone
  - [ ] pump settings override
    - [ ] override type (e.g. physical activity, preprandial, preset, sleep)
    - [ ] method = manual/automatic
    - [ ] duration of override

Device-specific? (Add any device-specific notes/additions here.)

### SMBG (Self-Monitored Blood Glucose)

  - [ ] blood glucose value
  - [ ] subType (`linked` or `manual`)[^2]
  - [ ] units of value
  - [ ] out-of-range values (LO or HI)
  - [ ] out-of-range value thresholds (e.g., often 20 for low and 600 for high on BGMs)

No Tidepool data model yet:

  - [ ] meal tag (i.e., pre- or post-meal)
  - [ ] other/freeform tags

Device-specific? (Add any device-specific notes/additions here.)

### Settings

  - [ ] basal schedules
    - [ ] name of basal schedule OR
    - [ ] name of settings profile
    - [ ] each schedule as a set of objects each with a rate and a start time
  - [ ] name of currently active basal schedule
  - [ ] units of all blood glucose-related fields (read from device, not hard-coded)
  - [ ] units of all carb-related fields (read from device, not hard-coded)
  - [ ] carb ratio(s)
    - [ ] name of settings profile
    - [ ] (one or more) set(s) of objects each with a ratio (amount) and a start time
  - [ ] insulin sensitivity factor(s)
    - [ ] name of settings profile
    - [ ] (one or more) set(s) of objects each with an amount and a start time
  - [ ] blood glucose target(s)
    - [ ] name of settings profile
    - [ ] (one or more) set(s) of objects each with a target and a start time
    - target shape:
        - [ ] shape `{low: 80, high: 120}` OR
        - [ ] shape `{target: 100}` OR
        - [ ] shape `{target: 100, range: 20}` OR
        - [ ] shape `{target: 100, high: 120}`
  - basal features:
    - [ ] temp basal type (`manual` or `percentage`)
    - [ ] max basal (as a u/hr rate)
  - bolus features:
    - [ ] bolus wizard/calculator enabled
    - [ ] extended boluses enabled
    - [ ] max bolus
  - [ ] insulin action time
  - [ ] display BG units
  - [ ] automated delivery
  - [ ] firmware version

Settings history:

  - [ ] device stores all changes to settings (including previous settings) OR
  - [ ] device only returns current settings at time of upload

No Tidepool data model yet:

  - [ ] low insulin alert threshold
  - auto-off:
    - [ ] enabled
    - [ ] threshold
  - [ ] language
  - reminders:
    - [ ] BG reminder
    - [ ] bolus reminder
  - [ ] alert settings (volume or vibration-only; whether enabled)
  - bolus features:
    - [ ] bolus increment for non-"quick"/manual boluses
    - [ ] min BG to allow calculation of bolus delivery
    - [ ] reverse correction enabled
    - quick/one-button bolus:
        - [ ] enabled
        - [ ] increment

Device-specific? (Add any device-specific notes/additions here.)

### Wizard / Bolus Calculator / Dosing Decision

  - [ ] recommended bolus dose
    - [ ] recommendation for carbohydrates
    - [ ] recommendation for correction (calculation from BG input)
    - net recommendation
        - [ ] net recommendation provided directly in data OR
        - [ ] net recommendation is just `recommended.carb` + `recommended.correction` OR
        - [ ] method for calculating net recommendation documented in spec/manual 
  - [ ] input blood glucose value
  - [ ] carbohydrate input in grams
  - [ ] insulin on board
  - [ ] insulin-to-carb ratio
  - [ ] insulin sensitivity factor (with units)
  - [ ] blood glucose target
    - [ ] shape `{low: 80, high: 120}` OR
    - [ ] shape `{target: 100}` OR
    - [ ] shape `{target: 100, range: 20}` OR
    - [ ] shape `{target: 100, high: 120}`
  - [ ] units of BG input and related fields (read from device, not hard-coded; related fields are `bgInput`, `bgTarget`, `insulinSensitivityFactor`)
  - [ ] link to bolus delivered as a result of wizard/calculator/decision (via log entry ID or similar)

Device-specific? (Add any device-specific notes/additions here.)

### General

  - [ ] device time is in UTC, with records using UTC timestamps, OR
  - [ ] internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
  - [ ] ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time

Device-specific? (Add any device-specific notes/additions here.)

### No Tidepool Data Model Yet

> **NB:** You can and should add to this section if there are other data types documented in the device's data protocol specification but not part of Tidepool's data model (yet).

  - [ ] activity/exercise
  - [ ] food (e.g., from a food database built into the pump)
  - [ ] notes/other events

[^1]: where `automatic` indicates an automated method (e.g. device) and `manual` indicates it was done manually (e.g. by a human)
[^2]: where `linked` indicates the value is coming from a linked device (e.g. meter linked to pump) and `manual` indicates it was entered by a human 
