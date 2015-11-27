Here is an example of the entire application state before the migration into redux, stringified into JSON:

```json
{
  "dropMenu": false,
  "howToUpdateKBLink": "https://tidepool-project.helpscoutdocs.com/article/6-how-to-install-or-upgrade-the-tidepool-uploader-gen",
  "page": "main",
  "user": {
    "userid": "abcdef123",
    "username": "jane+skip@tidepool.org",
    "emails": [
      "jane+skip@tidepool.org"
    ],
    "termsAccepted": "2015-11-17T16:10:53-08:00",
    "profile": {
      "fullName": "Jane Doe",
      "patient": {
        "birthday": "1980-01-01",
        "diagnosisDate": "1999-04-01",
        "about": "No thanks :P"
      }
    },
    "uploadGroups": [
      {
        "userid": "ghijkl456",
        "profile": {
          "fullName": "Jack Doe",
          "patient": {
            "birthday": "1982-05-01",
            "diagnosisDate": "1999-04-01",
            "about": "Another Doe sibling..."
          }
        }
      },
      {
        "userid": "abcdef123",
        "profile": {
          "fullName": "Jane Doe",
          "patient": {
            "birthday": "1980-01-01",
            "diagnosisDate": "1999-04-01",
            "about": "No thanks :P"
          }
        }
      }
    ]
  },
  "targetId": "abcdef123",
  "targetDevices": [
    "omnipod"
  ],
  "targetTimezone": "US/Pacific",
  "targetTimezoneLabel": null,
  "uploads": [
    {
      "name": "Medtronic (from CareLink)",
      "key": "carelink",
      "source": {
        "type": "carelink"
      }
    },
    {
      "name": "Insulet OmniPod",
      "key": "omnipod",
      "source": {
        "type": "block",
        "driverId": "InsuletOmniPod",
        "extension": ".ibf"
      },
      "progress": {
        "targetId": "abcdef123",
        "start": "2015-11-26T17:08:50-08:00",
        "step": "start",
        "percentage": 0,
        "finish": "2015-11-26T17:08:50-08:00",
        "error": {
          "version": "tidepool-uploader 0.233.0",
          "code": "E_SELECTING_FILE",
          "friendlyMessage": "Error during file selection",
          "stringifiedStack": "Object.appActions.readFile, onBlockModeInputChange, Object.LinkedValueUtils.executeOnChange, ReactDOMComponent._handleChange, Object.ReactErrorUtils.invokeGuardedCallback, executeDispatch, Object.executeDispatchesInOrder, executeDispatchesAndRelease, executeDispatchesAndReleaseTopLevel, Array.forEach",
          "debug": "Detail: Please choose a file ending in .ibf | Error UTC Time: 2015-11-26T17:08:50-08:00 | Code: E_SELECTING_FILE | Error Type: Error | Version: tidepool-uploader 0.233.0 | Stack Trace: Object.appActions.readFile, onBlockModeInputChange, Object.LinkedValueUtils.executeOnChange, ReactDOMComponent._handleChange, Object.ReactErrorUtils.invokeGuardedCallback, executeDispatch, Object.executeDispatchesInOrder, executeDispatchesAndRelease, executeDispatchesAndReleaseTopLevel, Array.forEach"
        }
      },
      "history": [
        {
          "targetId": "abcdef123",
          "start": "2015-11-26T17:08:50-08:00",
          "step": "start",
          "percentage": 0,
          "finish": "2015-11-26T17:08:50-08:00",
          "error": {
            "version": "tidepool-uploader 0.233.0",
            "code": "E_SELECTING_FILE",
            "friendlyMessage": "Error during file selection",
            "stringifiedStack": "Object.appActions.readFile, onBlockModeInputChange, Object.LinkedValueUtils.executeOnChange, ReactDOMComponent._handleChange, Object.ReactErrorUtils.invokeGuardedCallback, executeDispatch, Object.executeDispatchesInOrder, executeDispatchesAndRelease, executeDispatchesAndReleaseTopLevel, Array.forEach",
            "debug": "Detail: Please choose a file ending in .ibf | Error UTC Time: 2015-11-26T17:08:50-08:00 | Code: E_SELECTING_FILE | Error Type: Error | Version: tidepool-uploader 0.233.0 | Stack Trace: Object.appActions.readFile, onBlockModeInputChange, Object.LinkedValueUtils.executeOnChange, ReactDOMComponent._handleChange, Object.ReactErrorUtils.invokeGuardedCallback, executeDispatch, Object.executeDispatchesInOrder, executeDispatchesAndRelease, executeDispatchesAndReleaseTopLevel, Array.forEach"
          }
        }
      ]
    },
    {
      "name": "Dexcom G4",
      "key": "dexcom",
      "source": {
        "type": "device",
        "driverId": "DexcomG4"
      }
    },
    {
      "name": "Tandem",
      "key": "tandem",
      "source": {
        "type": "device",
        "driverId": "Tandem"
      }
    },
    {
      "name": "Bayer Contour Next",
      "key": "bayercontournext",
      "source": {
        "type": "device",
        "driverId": "BayerContourNext"
      }
    },
    {
      "name": "Bayer Contour Next USB",
      "key": "bayercontournextusb",
      "source": {
        "type": "device",
        "driverId": "BayerContourNextUsb"
      }
    },
    {
      "name": "Bayer Contour USB",
      "key": "bayercontourusb",
      "source": {
        "type": "device",
        "driverId": "BayerContourUsb"
      }
    },
    {
      "name": "Bayer Contour Next LINK",
      "key": "bayercontournextlink",
      "source": {
        "type": "device",
        "driverId": "BayerContourNextLink"
      }
    }
  ],
  "_os": "mac"
}
```