# Dexcom G4 & G5

## Checklist for CGM Implementation

(Key:

 - `[x]` available in data protocol/documented in spec and implemented
 - `[-]` available in data protocol/documented in spec but *not* yet implemented
 - `[?]` unknown whether available in data protocol/documented in spec; *not* yet implemented
 - `*[ ]` TODO: needs implementation!
 - `[ ]` unavailable in data protocol and/or not documented in spec and not yet implemented)

### Required if Present

#### CBG

  - `[x]` cbg values
  - `[?]` units of cbg values (read from device, not hard-coded)
  - `[x]` out-of-range values (LO or HI)
  - `[?]` out-of-range value thresholds (e.g., often 40 for low and 400 for high on CGMs)

Device-specific? (Add any device-specific notes/additions here.)

#### Device Events
  - `[x]` calibrations
    - `[x]` calibration value
    - `[?]` units of calibration value (read from device, not hard-coded)
  - `[x]` time changes (presence of which is also in the [BtUTC section](#bootstrapping-to-utc) below)
    - `[x]` device display time `from` (before change) and `to` (result of change)
    - `[x]` agent of change (`automatic` or `manual`)
    - `[ ]` timezone
    - `[ ]` reason for change (read from device)

Device-specific? (Add any device-specific notes/additions here.)

We are including the following in the payload for Dexcom time changes:

  - original system seconds (raw internal timestamp), used as the BtUTC index
  - raw old display offset
  - raw new display offset

#### Settings

  - `[?]` units preference for BG display
  - `[?]` units of data being uploaded (will be mutated to mmol/L storage units if not mmol/L)
  - `[x]` transmitter ID
  - `[x]` low alert settings
    - `[x]` enabled
    - `[x]` level/threshold
    - `[x]` snooze threshold
  - `[x]` high alert settings
    - `[x]` enabled
    - `[x]` level/threshold
    - `[x]` snooze threshold
  - `[x]` rate-of-change alerts
    - `[x]` fall rate alert
        - `[x]` enabled
        - `[x]` rate threshold for alerting
    - `[x]` rise rate alert
        - `[x]` enabled
        - `[x]` rate threshold for alerting
  - `[x]` out-of-range alerts
    - `[x]` enabled
    - `[x]` snooze time between alerts
  - `[ ]` predictive alerts
    - `[ ]` low prediction
        - `[ ]` enabled
        - `[ ]` time sensitivity (minutes to predicted low for alerting)
    - `[ ]` high prediction
        - `[ ]` enabled
        - `[ ]` time sensitivity (minutes to predicted high for alerting)
  - `[ ]` calibration alerts/reminders
    - `[ ]` pre-reminder
    - `[ ]` overdue alert

Settings history:

  - `[x]` device stores all changes to settings OR
  - `[ ]` device only returns current settings at time of upload

No Tidepool data model (yet): volume and/or vibrate mode of all alerts (can/should go in `payload`).

Device-specific? (Add any device-specific notes/additions here.)

We are including the following in the payload for Dexcom settings:

  - language
  - alarm profile name (e.g., "Attentive," "Hypo Repeat," etc.)
  - internal timestamp


#### User Events

    - `[x]` activity/exercise
    - `[x]` food (e.g., Dexcom allows logging carb events)
    - `[x]` notes/other events

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

  - `[x]` legacy "jellyfish" ingestion API
  - `[ ]` platform ingestion API

### Known implementation issues/TODOs

*Use this space to describe device-specific known issues or implementation TODOs **not** contained in the above datatype-specific sections.*
