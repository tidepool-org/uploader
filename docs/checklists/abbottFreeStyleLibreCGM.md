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
  - `[ ]` units of cbg values (read from device, not hard-coded)
  - `*[ ]` out-of-range values (LO or HI)
  - `*[ ]` out-of-range value thresholds (e.g., often 40 for low and 400 for high on CGMs)

Device-specific? (Add any device-specific notes/additions here.)
  - internal glucose unit is always mg/dL for this device, independent of display unit 
  - out-of-range thresholds are 40 mg/dL and 500 mg/dL
  - out-of-range measurements are reported as values 40 or 500 respectively

#### Device Events
  - `[ ]` calibrations
    - `[ ]` calibration value
    - `[ ]` units of calibration value (read from device, not hard-coded)
  - `[x]` time changes (presence of which is also in the [BtUTC section](#bootstrapping-to-utc) below)
    - `[x]` device display time `from` (before change) and `to` (result of change)
    - `[x]` agent of change (`automatic` or `manual`)
    - `[ ]` timezone
    - `[ ]` reason for change (read from device)

Device-specific? (Add any device-specific notes/additions here.)
  - device does not need calibration

#### Settings

  - `[x]` units preference for BG display
  - `[x]` units of data being uploaded (will be mutated to mmol/L storage units if not mmol/L)
  - `[x]` transmitter ID
  - `[ ]` low alert settings
    - `[ ]` enabled
    - `[ ]` level/threshold
    - `[ ]` snooze threshold
  - `[ ]` high alert settings
    - `[ ]` enabled
    - `[ ]` level/threshold
    - `[ ]` snooze threshold
  - `[ ]` rate-of-change alerts
    - `[ ]` fall rate alert
        - `[ ]` enabled
        - `[ ]` rate threshold for alerting
    - `[ ]` rise rate alert
        - `[ ]` enabled
        - `[ ]` rate threshold for alerting
  - `[ ]` out-of-range alerts
    - `[ ]` enabled
    - `[ ]` snooze time between alerts
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

  - `[ ]` device stores all changes to settings OR
  - `[x]` device only returns current settings at time of upload

No Tidepool data model (yet): volume and/or vibrate mode of all alerts (can/should go in `payload`).

Device-specific? (Add any device-specific notes/additions here.)

#### "Bootstrapping" to UTC

  - `[x]` index
    - `[ ]` UTC timestamp (*Hey, one can dream!*) OR
    - `[x]` internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
    - `[ ]` ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time
  - `[x]` date & time settings changes

Device-specific? (Add any device-specific notes/additions here.)

### No Tidepool Data Model Yet

> **NB:** You can and should add to this section if there are other data types documented in the device's data protocol specification but not part of Tidepool's data model (yet).

  - `[-]` activity/exercise
  - `[-]` food (e.g., Dexcom allows logging carb events)
  - `[-]` notes/other events
  - `[-]` insulin (rapid acting, long term)

### Tidepool ingestion API

Choose one of the following:

  - `[x]` legacy "jellyfish" ingestion API
  - `*[ ]` platform ingestion API

### Known implementation issues/TODOs

*Use this space to describe device-specific known issues or implementation TODOs **not** contained in the above datatype-specific sections.*
