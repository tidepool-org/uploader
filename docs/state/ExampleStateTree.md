## An Example State Tree

![Tidepool Uploader snapshot](./app-snapshot.png)

The JSON that follows on this page represents a snapshot of the Tidepool Uploader's application state as shown in the above screenshot. We provide this example mainly as a reference to use while reading the [glossary of terms](./StateTreeGlossary.md) for the Tidepool Uploader's redux-managed state tree.


```json
{
  "devices": {
    "carelink": {
      "instructions": ["Import from CareLink", "(We will not store your credentials)"],
      "isFetching": false,
      "key": "carelink",
      "name": "Medtronic",
      "selectName": "Medtronic (from CareLink)",
      "showDriverLink": {
        "mac": false,
        "win": false
      },
      "source": {
        "type": "carelink"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "omnipod": {
      "instructions": "Choose .ibf file from PDM",
      "key": "omnipod",
      "name": "Insulet OmniPod",
      "showDriverLink": {
        "mac": false,
        "win": false
      },
      "source": {
        "type": "block",
        "driverId": "InsuletOmniPod",
        "extension": ".ibf"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "dexcom": {
      "instructions": "Plug in receiver with micro-USB",
      "key": "dexcom",
      "name": "Dexcom",
      "showDriverLink": {
        "mac": true,
        "win": true
      },
      "source": {
        "type": "device",
        "driverId": "Dexcom"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "tandem": {
      "instructions": "Plug in pump with micro-USB",
      "key": "tandem",
      "name": "Tandem",
      "showDriverLink": {
        "mac": false,
        "win": true
      },
      "source": {
        "type": "device",
        "driverId": "Tandem"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "bayercontournext": {
      "instructions": "Plug in meter with micro-USB",
      "key": "bayercontournext",
      "name": "Bayer Contour Next",
      "showDriverLink": {
        "mac": false,
        "win": false
      },
      "source": {
        "type": "device",
        "driverId": "BayerContourNext"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "bayercontournextusb": {
      "instructions": "Plug meter into USB port",
      "key": "bayercontournextusb",
      "name": "Bayer Contour Next USB",
      "showDriverLink": {
        "mac": false,
        "win": false
      },
      "source": {
        "type": "device",
        "driverId": "BayerContourNextUsb"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "bayercontourusb": {
      "instructions": "Plug meter into USB port",
      "key": "bayercontourusb",
      "name": "Bayer Contour USB",
      "showDriverLink": {
        "mac": false,
        "win": false
      },
      "source": {
        "type": "device",
        "driverId": "BayerContourUsb"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    },
    "bayercontournextlink": {
      "instructions": "Plug meter into USB port",
      "key": "bayercontournextlink",
      "name": "Bayer Contour Next Link",
      "showDriverLink": {
        "mac": false,
        "win": false
      },
      "source": {
        "type": "device",
        "driverId": "BayerContourNextLink"
      },
      "enabled": {
        "mac": true,
        "win": true
      }
    }
  },
  "dropdown": true,
  "page": "MAIN",
  "unsupported": false,
  "blipUrls": {
    "forgotPassword": "http://localhost:3000/request-password-from-uploader",
    "signUp": "http://localhost:3000/signup",
    "viewDataLink": "http://localhost:3000/patients/4a86ec44ff/data"
  },
  "working": {
    "checkingVersion": false,
    "fetchingUserInfo": false,
    "initializingApp": false,
    "uploading": false
  },
  "uploadProgress": null,
  "uploadsByUser": {
    "4a86ec44ff": {
      "carelink": {
        "history": []
      },
      "bayercontournextlink": {
        "history": []
      }
    },
    "77541c89ba": {
      "omnipod": {
        "history": []
      },
      "dexcom": {
        "history": []
      }
    },
    "a6328f570d": {
      "tandem": {
        "history": []
      }
    },
    "a9c0de41c5": {
      "carelink": {
        "history": []
      }
    }
  },
  "uploadTargetDevice": null,
  "allUsers": {
    "77541c89ba": {
      "fullName": "John Doe",
      "patient": {
        "birthday": "2014-07-04",
        "diagnosisDate": "2016-01-01",
        "about": "I'm just a baby!",
        "isOtherPerson": true,
        "fullName": "Baby Doe"
      }
    },
    "a6328f570d": {
      "fullName": "Mary Doe",
      "patient": {
        "birthday": "1982-03-15",
        "diagnosisDate": "2000-12-25",
        "about": "I'm Jane's sister, and I also have type 1."
      }
    },
    "4a86ec44ff": {
      "fullName": "Jane Doe",
      "patient": {
        "birthday": "1980-07-04",
        "diagnosisDate": "1999-04-01",
        "about": "No thanks :P"
      }
    },
    "4fdc9dd8b4": {
      "username": "drdoe+skip@tidepool.org",
      "emails": ["drdoe+skip@tidepool.org"],
      "termsAccepted": "2016-02-01T15:04:42-08:00",
      "emailVerified": false,
      "fullName": "Doctor Doe"
    }
  },
  "loggedInUser": "4fdc9dd8b4",
  "loginErrorMessage": null,
  "targetDevices": {
    "77541c89ba": ["omnipod", "dexcom"],
    "a6328f570d": ["tandem"],
    "4a86ec44ff": ["carelink", "bayercontournextlink"]
  },
  "targetTimezones": {
    "77541c89ba": "US/Mountain",
    "4a86ec44ff": "US/Central"
  },
  "targetUsersForUpload": ["77541c89ba", "a6328f570d", "4a86ec44ff"],
  "uploadTargetUser": "4a86ec44ff"
}
```
