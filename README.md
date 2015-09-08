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

Configuration values (for example the URL of the Tidepool Platform) are set via environment variables. If you need to add a config value, modify the `.config.js` file. If you need to read a config value inside the app, use `var config = require('./lib/config')`. To set config values (do this before building the app), you can use Shell scripts that export environment variables (see config/local.sh for an example that exports the appropriate variables when [running the whole Tidepool platform locally using runservers](http://developer.tidepool.io/starting-up-services/)), for example:

```bash
$ source config/local.sh
$ npm start
```

### Debug Mode

The environment variable `DEBUG_ERROR` (boolean) controls whether or not errors are caught and an error message displayed in the UI (the production setting) or whether they are thrown in the console (much more useful for local development because then the file name and line number of the error are easily accessible). Debug mode is turned on by default in `config/debug.sh`.

## How to run the tests

```npm test```


## Publishing (to the devel/staging test Chrome store or production)

Assuming you've already merged any changes to master and are on master locally...

1. Start with a fresh Terminal window and `cd` into the chrome-uploader repo (Alternatively, just make certain you haven't set any environment variables locally; but jebeck likes to start fresh to be absolutely certain of this.)
1. Bump version number and tag with `mversion minor -m` (`npm install -g mversion` if you haven't already)
1. Push the new tag commit and tag up to GitHub with `git push origin master` and `git push origin --tags`
1. Checkout your new tag
1. Remove your node modules with `rm -rf node_modules/` (This may not always be necessary, but it's good to be safe in case anything has changed.)
1. Install fresh dependencies with `npm install`
1. Build the `dist.zip` file with `npm run build` - Look for the "**Using the default environment, which is now production**" message at the beginning of the build process. (You can check the success of a build (prior to publishing) by pointing 'Load unpacked extension' from chrome://extensions to the `dist/` subdir.)
1. Follow instructions in secrets for actually publishing to the Chrome store
1. Fill out the release notes for the tag on GitHub. If tag is known to *not* be a release candidate, mark as a pre-release.
