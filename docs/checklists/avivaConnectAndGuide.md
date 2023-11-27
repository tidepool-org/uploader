## Accu-Chek Aviva Connect, Guide & Guide Me

(Key:

 - `[x]` available in data protocol/documented in spec and implemented
 - `[-]` available in data protocol/documented in spec but *not* yet implemented
 - `[?]` unknown whether available in data protocol/documented in spec; *not* yet implemented
 - `*[ ]` TODO: needs implementation!
 - `[ ]` unavailable in data protocol and/or not documented in spec and not yet implemented)

### Required if Present

- `[x]` smbg values
- `[ ]` units of smbg values (read from device, not hard-coded)
- `[x]` out-of-range values (LO or HI)
- `[x]` out-of-range value thresholds (e.g., often 20 for low and 600 for high on BGMs)
- `[ ]` date & time settings changes
- `[ ]` blood ketone values
- `[ ]` units of blood ketone values (read from device, not hard-coded)
- `[ ]` ketone out-of-range values
- `[ ]` ketone out-of-range value thresholds
- `[x]` use `common.checkDeviceTime(currentDeviceTime, timezone, cb)` to check against server time

### No Tidepool Data Model Yet

- `[ ]` control (solution) tests (whether marked in UI or auto-detected) - until we have a data model, these should be discarded
- `[ ]` device settings, other than date & time (e.g., target blood glucose range)
- `[?]` tag/note (e.g., pre- vs. post-meal)

### Tidepool ingestion API

Choose one of the following:

  - `[ ]` legacy "jellyfish" ingestion API
  - `[x]` platform ingestion API

### Known implementation issues/TODOs

*Use this space to describe device-specific known issues or implementation TODOs **not** contained in the above datatype-specific sections.*
