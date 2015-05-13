# Tidepool Uploader

[![Build Status](https://travis-ci.org/tidepool-org/chrome-uploader.png)](https://travis-ci.org/tidepool-org/chrome-uploader)

This is a Chrome App that acts as an uploader client for Tidepool. It is intended to allow you to plug devices into the USB port and automatically load the data stored on it up to the Tidepool cloud.

WARNING! THIS SOURCE CODE IS UNDER ACTIVE DEVELOPMENT AND IS KNOWN TO BE INCOMPLETE AND WITH ERRORS. IT IS ACTIVELY CHANGING. THIS CODE SHOULD NOT BE USED FOR COMMERCIAL MEDICAL SYSTEMS OR FOR ANY PURPOSE OTHER THAN ONGOING DEVELOPMENT AND IMPROVEMENT OF THIS CODE.


## How to set it up

1. Clone this repository.
1. Run `npm install`
1. Set the config for the environment you want to target (see Config section below)
1. Run `npm start` (will bundle files, and watch for changes)
1. Open Chrome. Go to chrome://extensions and turn on Developer mode (checkbox on the top line).
1. Click "Load Unpacked Extension".
1. Choose the directory you checked out above and click OK.
1. To run it, you can choose "Launch" from the chrome://extensions page. You can also run it from the Chrome App Launcher, which Chrome may install for you whether you want it or not.
1. If you're developing, you may find that the only way it runs properly is to hit "Reload" after each change to the source. You will definitely need to reload any time you change the manifest.


## Config

Configuration values (for example the URL of the Tidepool Platform) are set via environment variables. If you need to add a config value, modify the `.config.js` file. If you need to read a config value inside the app, use `var config = require('./lib/config')`. To set config values (do this before building the app), you can use Shell scripts that export environment variables, for example:

```bash
$ source config/local.sh
$ npm start
```

## How to run the tests

```npm test```


## Publishing

1. Bump version number and tag with `mversion minor -m` (`npm install -g mversion` if you haven't already)
1. Build `dist.zip` file with `npm run build`
