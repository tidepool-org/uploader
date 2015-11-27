## Problems with the pre-redux state

There is quite a bit of room for improvement in the organization of the Tidepool uploader's application state as of the pre-redux implementation of the application described on [the previous page](README.md). This document outlines all areas that currently jump out as other than optimal.

- `howToUpdateKBLink` - probably belongs as part of the application's config, not in the state, since it will very rarely (or perhaps never) change

- `uploadGroups` - might be best pulled out of where its embedded currently with the logged-in `user` object since switching between target users is (now) a core piece of app functionality; the name `uploadGroups` could also perhaps be improved upon, since it is more natural to think of uploading to a particular patient's data storage account, not to the "group" of users that have access to that user's data

- `targetId`, `targetDevices`, and `targetTimezone` should either be tied together in a single object, or `targetDevices` and `targetTimezone` should be embedded within each `user` in `uploadGroups` and extracted as needed via lookup based on the current `targetId`

- `_os` should be renamed to `operatingSystem` for consistency with other attribute names

### uploads

`uploads` as an array is a relic of the early days of the Tidepool uploader when we were attempting to detect devices as they were plugged into the computer; we then started with an empty `uploads` array and pushed new devices into the array as devices were detected. Since we have abandoned the auto-device detection approach, we should reshape `uploads` as an object of key-value pairs. It also would make more sense to rename this object to `devices` or `dataSources` and to include a copy of it (perhaps filtered down to the `targetDevices`) embedded in each `user` in the `uploadGroups`. Alternatively, the `progress` and `history` for each data source should be embedded behind the `userid` for each potential target `user`.

For each device, the embedded `source` object is confusingly/opaquely named. It would be better to pull its attributes (`type`, `driverId`, and `extension`) up into the top level of the device object and get rid of `source` altogether.

#### progress

- `targetId` - unnecessary to include embedded within the `progress` info

- `finish` - should perhaps only be added if the upload completed *successfully*
