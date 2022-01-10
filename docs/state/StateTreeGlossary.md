## Glossary of Terms in the Tidepool Uploader's State Tree

### Preliminary

> **PWD**: Person With Diabetes (or, conveniently enough for us at Tidepool, Person With Data). Used as a shorthand for a user that has a Tidepool account *with* data storage, as opposed to a Tidepool user (such as a clinic worker, diabetes educator, endocrinologist etc.) whose account is not set up for data storage.

### User-Related State

All the state that is driven by user information and/or the login process is handled in the reducers in `app/reducers/users.js`.

#### `allUsers`

*The `allUsers` property is an object keyed by the user IDs of the logged-in user as well as all the PWDs the logged-in user has permissions to upload for. The information stored under each `userID` is all the account and profile information accessible to the logged-in user for that user.*

In essence, the `allUsers` object is where all user information accessible to the logged-in user is stored. Keeping all this information in one place keyed by `userId` allows us to only reference users by `userId` elsewhere in the state tree, thus maintaining a "normalized" state tree with a single source of truth for user-related information. (Cf. Dan Abramov's presentation of the "normalization" problem in the README for his [normalizr library](https://github.com/gaearon/normalizr#the-problem).) Whenever a component needs additional information (that is, beyond `userId`) about a user, that information can be retrieved via lookup under the `userId`.

Examples of properties that may be encoded in `allUsers` for a particular user include `fullName`, `emails`, a `patient` object that itself includes the PWD's `birthday` and `diagnosisData`. Also see the [example state tree](./ExampleStateTree.md) for full examples.

### `memberships`

*The `memberships` property is an object keyed by the user IDs of the logged-in user as well as all the PWDs the logged-in user has some permissions on. Each entry contains a `permissions` object which in turn has keys representing various permissions, each of which will have an empty object and the existence of the key indicates the presence of that permission. Some permissions include `custodian`, `view` and `upload`.

#### `loggedInUser`

*The property `loggedInUser` encodes the `userID` of the currently logged-in user.*

If no user is (yet) logged in, the value of `loggedInUser` is `null`.

#### `loginErrorMessage`

*The property `loginErrorMessage` encodes the error message if there is an error on an attempt to log in.*

If there has not (yet) been a login attempt or login proceeded without error, the value of `loginErrorMessage` is `null`.

#### `updateProfileErrorMessage`

*The property `updateProfileErrorMessage` encodes the error message if there is an error on an attempt to update the user's profile information.*

If there has not (yet) been an error updating profile information or profile information update proceeded without error, the value of `updateProfileErrorMessage` is `null`.

#### `updateProfileErrorDismissed`

*The property `updateProfileErrorDismissed`  is a flag indicating whether the user has dismissed the displayed `uploadProfileErrorMessage`. *

If the user has not dismissed the error or if there has been no error to dismiss, the value of `updateProfileErrorDismissed` is `null`. If the user has dismissed an existing error, the value is `true`.

#### `createCustodialAccountErrorMessage`

*The property `createCustodialAccountErrorMessage` encodes the error message if there is an error on an attempt to create a new custodial account.*

If there has not (yet) been an error creating a custodial account or account creation proceeded without error, the value of `createCustodialAccountErrorMessage` is `null`.

#### `createCustodialAccountErrorDismissed`

*The property `createCustodialAccountErrorDismissed`  is a flag indicating whether the user has dismissed the displayed `createCustodialAccountErrorMessage`. *

If the user has not dismissed the error or if there has been no error to dismiss, the value of `createCustodialAccountErrorDismissed` is `false`. If the user has dismissed an existing error, the value is `true`.

#### `targetDevices`

*The property `targetDevices` is an object keyed by the user IDs of all the PWDs the logged-in user has permissions to upload for (including the logged-in user, if applicable). The information stored under each `userId` is an array of the `deviceKey`s selected for that user as potential sources of data to upload to the Tidepool cloud.*

#### `targetTimezones`

*The property `targetTimezones` is an object keyed by the user IDs of all the PWDs the logged-in user has permissions to upload for (including the logged-in user, if applicable). The information stored under each `userId` is a string timezone name (from the [IANA Time Zone Database](http://www.iana.org/time-zones) by way of the [Moment Timezone](http://momentjs.com/timezone/) JavaScript library).*

In the future we plan to support the possibility of selecting a timezone for each device a user has selected as a source of data to upload to Tidepool. When we introduce such support, we will change the value of the information stored under each `userId` in `targetTimezones` to an object keyed by the `deviceKey`s selected by the user.

#### `targetUsersForUpload`

*The property `targetUsersForUpload` is an array consisting of the `userId`s of all the PWDs the logged-in user has permissions to upload for (including the logged-in user, if applicable).*

This array drives the user selection dropdown menu that provides the interface for setting and changing the `uploadTargetUser`.

#### `uploadTargetUser`

*The propery `uploadTargetUser` encodes the `userId` (for lookup in the [`allUsers`](#-allusers) branch of the state tree) of the PWD currently selected as the target for data upload.*

The combination of `uploadTargetUser` and `uploadTargetDevice` provides the path into `uploadsByUser` to the upload currently in progress, if any.

* * *

### (Current) Upload-Related State

All the state that is driven by the current (i.e., in progress) or recent upload(s) is handled in the reducers in `app/reducers/uploads.js`.

#### `uploadProgress`

*The `uploadProgress` property is an object with two keys: `percentage` to record the percentage towards completion of the current upload in progress and `step` to encode the current step in the upload sequence (e.g., device detection, device read, POSTing data to the Tidepool data ingestion API). Optionally a third key, `isFirstUpload`, can be used to indicate that the upload is the first upload from a device. This is useful for delta uploads, to display a message that the first upload will take longer than subsequent uploads.*

When there is not an upload in progress, the value of `uploadProgress` is `null`.

#### `uploadsByUser`

*The `uploadsByUser` property is an object keyed by the user IDs of all the PWDs the logged-in user has permissions to upload for (including the logged-in user, if applicable). Within each user ID is another object keyed by the devices that user has selected to upload data from, if any. The information stored at each userId, deviceKey path is semi-ephemeral information about the state of current and recent uploads.*

One example of a property that is encoded in the object at the termination of each `userId`, `deviceKey` path is the `history` of the user's uploading for that device, which is an array of objects with up to a maximum of `start` and `finish` timestamps and a boolean `error` to encode whether the upload was successful. Other examples are additional boolean flags regarding the upload's state: `completed`, `failed`, `successful`, and `uploading`. If an upload failed due to an error, the error object itself is included in an `error` field. For block-mode devices, there are additional flags and fields such as boolean flags for `choosingFile` and `readingFile` and `file` object encoding the `name` and `data` from a selected file.

#### `uploadTargetDevice`

*The property `uploadTargetDevice` encodes the `key` (for lookup in the [`devices`](#-devices) branch of the state tree) of the device currently being uploaded when an upload is in progress.*

When an upload is *not* in progress, the value of `uploadTargetDevice` is `null`. The combination of `uploadTargetUser` and `uploadTargetDevice` provides the path into `uploadsByUser` to the upload currently in progress, if any.

* * *

### All Other App State

All other app state is handled in the reducers in `app/reducers/misc.js`.

#### `blipUrls`

*The property `blipUrls` is an object with three properties: `forgotPassword`, `signUp`, and `viewDataLink`, all URLs for Tidepool's webapp blip.*

The `forgotPassword` and `signUp` links are built as part of the app initialization step for the configured or chosen server environment (the default is production).

The `viewDataLink` is built every time the `uploadTargetUser` is chosen or changed.

**NB:** Storing these URLs as state is not ideal. Both the forgot password and sign-up URLs are essentially *derived* state - derived from a combination of route paths (e.g., `/signup`), which are constants, and a single piece of state - the server environment. The `viewDataLink` is also derived state from a combination of route paths, the server environment, and the `uploadTargetUser`. For now, we are keeping these URLs in the state tree because we do *not* represent the server environment in the state tree.

#### `devices`

*The `devices` property on the state tree is an object keyed by the `id` of each device (or data source) supported by the Tidepool Uploader.*

 `devices` *almost* does not belong in the state tree at all, because it is *almost* a constant. However, it is subject to filtering based on operating system; this filtering happens as part of the app initialization step when a user launches the Tidepool Uploader. The property `enabled` - itself an object with `mac` and `win` as its keys - encodes the devices Tidepool currently support on each platform.

The properties of each "device" in `devices` should be fairly self-explanatory. For example, the `instructions` property stores the text that appears in the UI under each device name to give the user some indication of how to proceed (e.g., what type of cable is required to connect a particular device).

#### `dropdown`

*The Tidepool Uploader inclues a dropdown menu, which is accessible after logging in by clicking on the area where the logged-in user's name is displayed in the upper-right corner. The property `dropdown` in the state tree encodes whether this menu is currently in its open (dropped-down) state (`true`) or closed and hidden (`false`).*

#### `unsupported`

*The property `unsupported` encodes whether the running version of the Tidepool Uploader is outdated from the perspective of Tidepool's data ingestion API. **This property defaults to true**; in other words, any instance of the uploader is assumed to be outdated and unsupported until it proves itself otherwise.*

To ensure the highest possible standards of data quality, it is very important for us at Tidepool to prevent uploaders that have been succeeded by newer versions from uploading to the Tidepool cloud. To this end, we have implemented an "info" endpoint on our data ingestion API that responds with (among other things) the minimum version of the Tidepool Uploader that the data ingestion API will accept data from.

#### `working`

*The `working` property is an object with a small handful of keys that record the app's current state with respect to certain asynchronous actions.*

The properties `initializingApp.inProgress` (which defaults to `true`) and `checkingVersion.inProgress` serve to prevent rendering the warning message about the Tidepool Uploader being unsupported before the application has finished checking against the Tidepool data ingestion API to determine whether it is outdated and unsupported. (See [unsupported](#-unsupported) above, taking care to note that `unsupported` defaults to `true`, so without some other indicator(s) of the app's state with respect to validation of the current version against the Tidepool data ingestion API, the "uploader unsupported" warning message would render immediately.)

The property `checkingElectronUpdate.inProgress` is used to indicate whether or not the Electron auto-update system is currently awating the message from the `main` Electron process indicating whether or not an update is currently available.

Finally, the property `uploading.inProgress` is used to disable certain UI features while an upload is in progress. When `uploading.inProgress` is true, the dropdown menu for selecting the `uploadTargetUser` as well as the link to "Choose devices" in the dropdown menu are disabled until the current upload is completed, as changing the target user for upload and/or the devices chosen for upload while an upload is in progress for a particular user and device is not supported behavior.

* * *

### State relating to application updates

#### `electronUpdateManualChecked`

*The property `electronUpdateManualChecked` encodes whether the current check for updates to the Electron application was initiated by a user or was done automatically*

The update system needs to differentiate manually initiated update checks vs. update checks that happen automatically (like on application launch and periodic background checks) in order to provide proper messaging to the user in each situation.

#### `electronUpdateAvailableDismissed`

*The property `electronUpdateAvailableDismissed` encodes whether the current notification for an update to the Electron application was dismissed by a user*

This property is used to ensure that users are not notified repeatedly that an update is available if they have already dismissed the notification once.

#### `electronUpdateAvailable`

*The property `electronUpdateAvailable` encodes whether there is an update to the currently running Electron application or not*

This property is true when the update system check for updates has finished and there is an update available.

#### `electronUpdateDownloaded`

*The property `electronUpdateDownloaded` encodes whether an available update to the currently running Electron application has been downloaded and is ready to install*

This property is true when the update system has finished downloading an available update.
