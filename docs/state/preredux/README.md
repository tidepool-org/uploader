## Tidepool uploader state pre-redux

This document outlines the application state management in the current (v0.233.0) version of the Tidepool uploader, prior to migrating the application state management into [redux](http://redux.js.org/).

The Tidepool uploader currently manages state using a single global object to represent the entirety of the application's state. All possible changes to the global state are performed through a set of functions found in [`lib/state/appActions.js`](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/state/appActions.js).

Simple attributes of the global state object:

- `dropMenu` - a boolean encoding whether the dropdown menu available by clicking on the logged-in user's name in the upper-right corner is currently visible (`true`) or hidden (`false`)

- `howToUpdateKBLink` - the URL for [the Tidepool knowledge base article explaining how to update the uploader](https://tidepool-project.helpscoutdocs.com/article/6-how-to-install-or-upgrade-the-tidepool-uploader-gen)

- `page` - the current "page" of the app being rendered
   + "page" in scare quotes because of the uploader's nature as a single-page app with no router
   + options for "page" are `loading`, `login`, `settings`, `main`, and `error`


- `user` - the logged-in [Tidepool `user`](http://developer.tidepool.io/data-model/platform/types/user.html), augmented with `uploadGroups`, an array of `user`s that the logged-in user has upload permissions for, *including the logged-in user him- or herself*

- `targetId` - the `userid` of the [Tidepool `user`](http://developer.tidepool.io/data-model/platform/types/user.html) currently selected as the target for data upload; may or may not be the logged-in user's `userid`

- `targetDevices` - an array of device `key`s (see [`uploads`](#uploads) below); these are the `key`s for all devices selected as potential targets for data upload from the `settings` "page" for the `targetId` user

- `targetTimezone` - a string timezone name (e.g., `US/Pacific`) understood by the [moment timezone](http://momentjs.com/timezone/) JavaScript library for manipulating dates & times with timezone-awareness and selected as the timezone of all devices from the `settings` "page" for the `targetId` user

- `targetTimezoneLabel` - contains the value `null`; a relic of a previous way of managing timezone names

- `_os` - a string encoding the current operating system environment; possible values are `mac`, `win`, `android`, `cros`, `linux`, and `openbsd`

### uploads

A great deal of the application state relating to device data uploads in the uploader is contained within the `uploads` array. When the app is initialized, this array is generated from all the possible sources of diabetes device data given the current `_os`, and each object in the array has the following attributes:

- `name` - a string value encoding the name for the device as it will be displayed in the UI
- `key` - a string value providing a unique key for the device (e.g., `tandem` for Tandem insulin pumps)
- `source` an object containing further information about the device:
   + (REQUIRED) `type` - how device data is obtained, values can be `carelink`, `block` (for block-mode devices such as the Insulet OmniPod), and `device`
   + (OPTIONAL) `driverId` - the unique identifier for the device driver; these IDs are specified and used in [`lib/core/device.js`](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/core/device.js)
   + (OPTIONAL) `extension` - the file extension for block-mode devices

#### progress

During an upload attempt, a `progress` object is added to the device in `uploads` that is currently in use. This object has the following attributes:

- `targetId` - the `userid` of the [Tidepool `user`](http://developer.tidepool.io/data-model/platform/types/user.html) currently selected as the target for data upload; may or may not be the logged-in user's `userid`

- `start` - an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-formatted timestamp with timezone offset encoding the date & time the upload attempt began

- `step` - the current step of device data upload; possible values are `start`, `setup`, `connect`, `getConfigInfo`, `fetchData`, `processData`, `uploadData`, `disconnect`, and `cleanup` (except for the first of these, all of these match the required steps defined in the [driver manager](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/driverManager.js))

- `percentage` - the current percentage towards completion of the upload attempt

- `finish` - an [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)-formatted timestamp with timezone offset encoding the date & time the upload attempt completed or failed

- `error` - an object encoding details of any error that caused the upload to fail; attributes include:
   + `version` - a string encoding the current uploader application version
   + `code` - an error code; possible values are: `E_SETUP`, `E_LOGIN`, `E_AFTER_LOGIN`, `E_LOGOUT`, `E_DETECTING_DEVICES`, `E_SELECTING_FILE`, `E_READING_FILE`, `E_UPLOADING`, `E_METADATA_UPLOAD`, `E_DEVICE_UPLOAD`, `E_DEVICE_DETECT`, `E_CARELINK_UPLOAD`, and `E_CARELINK_FETCH` (these are currently defined in [`lib/state/appActions.js`](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/state/appActions.js#L56))
   + `friendlyMessage` - a user-friendly description of the error state, based on the `code` and also currently defined in [`lib/state/appActions.js`](https://github.com/tidepool-org/chrome-uploader/blob/master/lib/state/appActions.js)
   + `stringifiedStack` - a stringified stack trace
   + `debug` - a string encoding all of the previously listed attributes, as well as other information, for display in the "show details" expansion of the error state UI

After an upload completes or errors out, the entire `progress` object is cloned and pushed into a `history` array attached to the appropriate device in `uploads`.
