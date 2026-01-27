## Checklist for CGM Implementation

### CBG (Continous Blood Glucose value)

  - [ ] cbg values
  - [ ] units of cbg values (read from device, not hard-coded)
  - [ ] out-of-range values (LO or HI)
  - [ ] out-of-range value thresholds (e.g., often 40 for low and 400 for high on CGMs)

Device-specific? (Add any device-specific notes/additions here.)

### Device Events

  - [ ] calibrations
    - [ ] calibration value
    - [ ] units of calibration value (read from device, not hard-coded)
  - [ ] time changes
    - [ ] device display time `from` (before change) and `to` (result of change)
    - [ ] agent of change (`automatic` or `manual`)[^1]
    - [ ] timezone
    - [ ] reason for change (read from device)

Device-specific? (Add any device-specific notes/additions here.)

### CGM Settings

  - [ ] units preference for BG display
  - [ ] units of data being uploaded
  - [ ] transmitter ID (if used)
  - [ ] low alert settings
    - [ ] enabled
    - [ ] level/threshold
    - [ ] snooze threshold
  - [ ] high alert settings
    - [ ] enabled
    - [ ] level/threshold
    - [ ] snooze threshold
  - [ ] rate-of-change alerts
    - [ ] fall rate alert
        - [ ] enabled
        - [ ] rate threshold for alerting
    - [ ] rise rate alert
        - [ ] enabled
        - [ ] rate threshold for alerting
  - [ ] out-of-range alerts
    - [ ] enabled
    - [ ] snooze time between alerts
  - [ ] predictive alerts
    - [ ] low prediction
        - [ ] enabled
        - [ ] time sensitivity (minutes to predicted low for alerting)
    - [ ] high prediction
        - [ ] enabled
        - [ ] time sensitivity (minutes to predicted high for alerting)
  - [ ] calibration alerts/reminders
    - [ ] pre-reminder
    - [ ] overdue alert

Settings history:

  - [ ] device stores all changes to settings (including previous settings) OR
  - [ ] device only returns current settings at time of upload

No Tidepool data model (yet):

  - [ ] volume and/or vibrate mode of all alerts

Device-specific? (Add any device-specific notes/additions here.)

### General

  - [ ] device time is in UTC, with records using UTC timestamps, OR
  - [ ] internal timestamp or persistent log index (across device communication sessions) to order all pump events (regardless of type), independent of device display time OR
  - [ ] ephemeral log index (does not persist across device communication sessions) to order all pump events (regardless of type), independent of device display time

Device-specific? (Add any device-specific notes/additions here.)

### No Tidepool Data Model Yet

> **NB:** You can and should add to this section if there are other data types documented in the device's data protocol specification but not part of Tidepool's data model (yet).

  - [ ] activity/exercise
  - [ ] food (e.g. carb events)
  - [ ] notes/other events

[^1]: where `automatic` indicates an automated method (e.g. device) and `manual` indicates it was done manually (e.g. by a human)
