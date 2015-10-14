## Checklist for Insulin Pump Implementation

(Key:

 - `[x]` available in data protocol/documented in spec and implemented
 - `[-]` available in data protocol/documented in spec but *not* yet implemented
 - `[?]` unknown whether available in data protocol/documented in spec; *not* yet implemented
 - `*[ ]` TODO: needs implementation!
 - `[ ]` unavailable in data protocol and/or not documented in spec and not yet implemented)

### Required if Present

#### Basals

  - `[ ]` scheduled basal
    - `[ ]` basal rate intervals with a start time, duration, and rate delivered
    - `[ ]` name of basal schedule on each scheduled basal rate interval
  - `[ ]` manual temp basal
    - `[ ]` basal rate intervals with a start time, duration, and rate delivered
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[ ]` percentage temp basal
    - `[ ]` basal rate intervals with a start time, duration, percent
        - `[ ]` rate provided directly OR
        - `[ ]` rate computed from percent x suppressed.rate
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the temp basal intersects*
  - `[ ]` "suspended" basals (see [status - suspends & resumes)[#device-events] below)
    - `[ ]` basal interval with a start time and duration but no rate (b/c suspended)
    - `[ ]` object representing suppressed scheduled basal *for each segment of the basal schedule that the suspension of insulin delivery intersects*
  - `[ ]` final (most recent) basal
    - `[ ]` basal rate interval with a start time, duration "guessed" from settings, rate delivered, and an annotation re: the "guessed" duration OR
    - `[ ]` basal rate interval with a start time and rate, no (= zero) duration

#### Boluses

  - `[ ]` normal bolus
    - `[ ]` amount of insulin delivered
    - `[ ]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
  - `[ ]` extended bolus
    - `[ ]` amount of insulin delivered
    - `[ ]` duration of insulin delivery
    - `[ ]` amount of insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[ ]` duration of insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
  - `[ ]` combo/dual bolus
    - `[ ]` amount of insulin delivered - immediate (normal)
    - `[ ]` amount of insulin delivered - extended
    - `[ ]` duration of extended insulin delivery
    - `[ ]` amount of immediate insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[ ]` amount of extended insulin delivery programmed (if differs from actual delivery, in case of bolus interruption, cancellation, etc.)
    - `[ ]` duration of extended insulin delivery programmed (if differs from actual duration, in case of bolus interruption, cancellation, etc.)
  - bolus cancellations/interruptions
    - `[ ]` represented by a separate event in the device's data log OR
    - `[ ]` result in modifications to a bolus event in the device's data log

#### CBG

(See [the CGM checklist](CGMChecklist.md) instead.)

#### Device Events

#### SMBG

  - `[ ]` blood glucose value
  - `[ ]` subType (`linked` or `manual`)
  - `[ ]` units of value (read from device, not hard-coded)
  - `[ ]` out-of-range values (LO or HI)
  - `[ ]` out-of-range value thresholds (e.g., often 20 for low and 600 for high on BGMs)

No Tidepool data model yet:

  - `[ ]` meal tag (i.e., pre- or post-meal)
  - `[ ]` other/freeform tags

#### Settings

  - `[ ]` basal schedules
    - `[ ]` name of basal schedule OR
    - `[ ]` name of settings profile
    - `[ ]` each schedule as a set of objects each with a rate and a start time
  - `[ ]` name of currently active basal schedule
  - `[ ]` units of all blood glucose-related fields (read from device, not hard-coded)
  - `[ ]` units of all carb-related fields (read from device, not hard-coded)
  - `[ ]` carb ratio(s)
    - `[ ]` name of settings profile
    - `[ ]` (one or more) set(s) of objects each with a ratio (amount) and a start time
  - `[ ]` insulin sensitivity factor(s)
    - `[ ]` name of settings profile
    - `[ ]` (one or more) set(s) of objects each with an amount and a start time
  - `[ ]` blood glucose target(s)
    - `[ ]` name of settings profile
    - `[ ]` (one or more) set(s) of objects each with a target and a start time
    - target shape:
        - `[ ]` shape `{target: 100, low: 80, high: 120}` OR
        - `[ ]` shape `{target: 100, range: 20}` OR
        - `[ ]` shape `{target: 100, high: 120}`

Settings history:

  - `[ ]` device stores all changes to settings OR
  - `[ ]` device only returns current settings at time of upload

#### Wizard

  - `[ ]` recommended bolus dose
    - `[ ]` recommendation for carbohydrates
    - `[ ]` recommendation for correction (calculation from BG input)
    - net recommendation
        - `[ ]` net recommendation provided directed in data OR
        - `[ ]` net recommendation is just `recommended.carb` + `recommended.correction` OR
        - `[ ]` method for calculating net recommendation documented in data spec
        - `[ ]` method for calculating net recommendation reverse-engineered from pump manuals/test data
  - `[ ]` input blood glucose value
  - `[ ]` carbohydrate input in grams
  - `[ ]` insulin on board
  - `[ ]` insulin-to-carb ratio
  - `[ ]` insulin sensitivity factor (with units)
  - `[ ]` blood glucose target
    - `[ ]` shape `{target: 100, low: 80, high: 120}` OR
    - `[ ]` shape `{target: 100, range: 20}` OR
    - `[ ]` shape `{target: 100, high: 120}`
  - `[ ]` units of BG input and related fields (read from device, not hard-coded; related fields are `bgInput`, `bgTarget`, `insulinSensitivityFactor`)
  - `[ ]` link to bolus delivered as a result of wizard (via log entry ID or similar)

#### "Bootstrapping" to UTC

  - `[ ]` index
    - `[ ]` UTC timestamp (*Hey, one can dream!*) OR
    - `[ ]` internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
    - `[ ]` ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time
  - `[ ]` date & time settings changes

### No Tidepool Data Model Yet

  - `[ ]` activity/exercise
  - `[ ]` food (e.g., from a food database built into the pump)
  - `[ ]` notes