# Tidepool Uploader

[![Build Status](https://img.shields.io/travis/tidepool-org/chrome-uploader/master.svg)](https://travis-ci.org/tidepool-org/chrome-uploader)

This is a [Chrome App](https://developer.chrome.com/apps/about_apps) that acts as an uploader client for Tidepool. It is intended to allow you to plug diabetes devices into your computer's USB port, read the data stored on them, and upload a standardized version of the data to the Tidepool cloud.

This README is focused on just the details of getting the uploader running locally. For more detailed information aimed at those working on the development of the uploader, please see the [developer guide](docs/StartHere.md).

#### Table of contents

- [Set Up](#how-to-set-it-up)
- [Config](#config)
- [Tests](#tests)
- [Linting & Code Style](#linting--code-style)
- [Docs](#docs)
- [Publishing](#publishing-to-the-develstaging-testing--development-chrome-store-account-or-production)

* * * * *

## How to set it up

1. Clone this repository.
1. Run `npm install`
1. Set the config for the environment you want to target (see [Config](#config) below)
1. Run `npm start` (This will bundle the application with webpack and watch for changes. When it stops printing output you can continue to the next step.)
1. Open Chrome. Go to chrome://extensions and turn on Developer mode (checkbox on the top line).
1. Click "Load Unpacked Extension".
1. Choose the directory where you cloned the repository and click OK. (You may see a warning from Chrome concerning the inclusion of a key file. (`This extension includes the key file '<project_path>/node_modules/webpack-dev-server/node_modules/sockjs-client/node_modules/eventsource/test/key.pem`) This is due to the loading of all the `node_modules` and their various internal testing utilities. This isn't a security issue, nor is the associated key used or referenced anywhere in the running code and can safely be ignored.)
1. To run it, you can choose "Launch" from the chrome://extensions page. You can also run it from the Chrome App Launcher, which Chrome may install for you whether you want it or not.
1. To open the JavaScript console/Chrome Dev Tools, click on the `index.html` link in the section of chrome://extensions devoted to the uploader. (Note: this link will only appear after you've launched the uploader.)
1. React components and CSS will hot load after changes (this can be confirmed by watching the JavaScript console), but changes to device drivers and other code outside of the React components will not - use 'Reload' from chrome://extensions to reload after such changes. If the compilation/hot reload of a component fails for any reason (e.g. from a syntax error) you may need to reinitialize the hot loader by reloading the extension. You will definitely need to reload any time you change the manifest.

## Config

Configuration values (for example the URL of the Tidepool Platform) are set via environment variables. If you need to add a config value, modify the `.config.js` file. If you need to read a config value inside the app, use `var config = require('./lib/config')`. To set config values (do this before building the app), you can use Shell scripts that export environment variables (see config/local.sh for an example that exports the appropriate variables when [running the whole Tidepool platform locally using runservers](http://developer.tidepool.io/starting-up-services/)), for example:

```bash
$ source config/local.sh
$ npm start
```

### Debug Mode(s)

For ease of development we have several debug features that developers can turn on and off at will (and to suit various development use cases, such as working on a new device driver versus working on the app's UI). Each of these debug features is set with an environment variable, but rather than being loaded through `.config.js` (as we do for production configuration variables, see above), we load these through the webpack `DefinePlugin` (see [Pete Hunt's webpack-howto](https://github.com/petehunt/webpack-howto#6-feature-flags) for an example, although note Hunt uses the term 'feature flag').

#### `DEBUG_ERROR`

The environment variable `DEBUG_ERROR` (boolean) controls whether or not errors sourced in device drivers are caught and an error message displayed in the UI (the production setting) or whether they are thrown in the console (much more useful for local development because then the file name and line number of the error are easily accessible, along with a stack trace). `DEBUG_ERROR` mode is turned on by default in `config/device-debug.sh`.

#### `REDUX_LOG`

The environment variable `REDUX_LOG` (boolean) controls whether or not the [redux logger middleware](https://github.com/fcomb/redux-logger/blob/master/README.md) is included. This middleware logs all redux actions in the Chrome developer console, including the (entire) previous and following app state trees. It is primarily useful when working on the UI of the app, and in fact can be quite performance-expensive (especially when uploading a device, due to the fact that every update to the progress bar constitutes an action), so it is not recommended to turn it on while working on device code.

#### `REDUX_DEV_UI`

The environment variable `REDUX_DEV_UI` (boolean) controls whether or not the [redux dev tools UI](https://github.com/gaearon/redux-devtools/blob/master/README.md) is included. The redux dev tools add a UI interface for exploring - and, to a limited extent, manipulating - app actions and state. Even when `REDUX_DEV_UI` is `true`, we have the dev tools hidden by default: the key combination `ctrl + h` will toggle their visibility. The key combination `ctrl + q` will rotate (clockwise) the location at which the dev tools are anchored; the default is for them to be anchored at the bottom of the app. Similarly to the redux logger middleware, the redux dev tools UI is also quite performance expensive and only recommended for use while working on UI code.

`REDUX_LOG` and `REDUX_DEV_UI` are both turned on by default in `config/ui-debug.sh`.

### Local Development w/o Debug Mode(s)

All debug options are turned *off* by default in `config/local.sh`.

## Tests

There are two sets of (unit) tests for the code in this repository.

The tests for all device and data-processing code currently run in the [nodejs](https://nodejs.org/en/) server-side JavaScript environment. (We plan to eventually migrate these tests to run in-browser since the code itself runs in-browser in the Chrome App.)

The tests for all the UI code run using the [Karma test runner](https://karma-runner.github.io/0.13/index.html) in [the headless WebKit browser PhantomJS](http://phantomjs.org/) or the Chrome browser.

To run the tests in this repository as they are run on Travis CI, use:

```bash
$ npm test
```

To run just the UI tests in both PhantomJS and Chrome *locally*, use:

```bash
$ npm run browser-tests
```

To run just the device and data-processing tests in node, use:

```bash
$ npm run node-tests
```

To run just the UI tests in PhantomJS with webpack & Karma watching all files for changes and both rebundling the app and re-running the tests on every change, use:

```bash
$ npm run test-watch
```

## Linting & Code Style

We use [ESLint](http://eslint.org/) to lint our JavaScript code. We try to use the same linting options across all our client apps, but there are a few exceptions in this application, noted with comments in the `.eslintrc` configuration file.

To run the linter (which also runs on Travis CI with every push, along with `npm test`), use:

```
$ npm run lint
```

Aside from the (fairly minimal) JavaScript code style options we *enforce* through the linter, we ask that internal developers and external contributors try to match the style of the code in each module being modified. New modules should look to similar modules for style guidance. In React component code, use existing ES6/ES2015 components (not legacy ES5 components) as the style model for new components.

**NB: Please keep ES5 and ES6/ES2015 code distinct. Do *NOT* use ES6/ES2105 features in ES5 modules (most easily recognizable by the use of `require` rather than `import`).**

## Docs

Docs reside in several places in this repository, such as `docs/` and `lib/drivers/docs`. They are built as a static site with [GitBook](https://www.gitbook.com/ 'GitBook') and served at [developer.tidepool.io/](http://developer.tidepool.io/) via [GitHub Pages](https://pages.github.com/ 'GitHub Pages').

See [this guidance on our use of GitBook at Tidepool](http://developer.tidepool.io/docs/).

## Publishing (to the devel/staging testing & development Chrome store account or production)

When you're ready to merge your pull request, first

1. Use the command `mversion minor -m` to bump the version number and create a tag. (You will need to `npm install -g mversion` if you don't have [mversion](https://github.com/mikaelbr/mversion) installed already.)
1. Push the new tag commit and tag up to GitHub with `git push origin <branch_name>` and `git push origin --tags`.
1. Merge your approved pull request.

Assuming you've already merged any changes to master and are on master locally...

1. Start with a fresh Terminal window and `cd` into the chrome-uploader repo. (Alternatively, just make certain you haven't set any environment variables locally; but jebeck likes to start fresh to be absolutely certain of this.)
1. Checkout the tag you wish to build, using `git checkout tags/<tag_name>`.
1. Remove your node modules with `rm -rf node_modules/`. (This may not always be necessary, but it's good to be safe in case anything has changed.)
1. Make sure you are using node v0.12.7 and install fresh dependencies with `npm install`.
1. Build the `dist.zip` file with `npm run build`. Look for the "**Using the default environment, which is now production**" message at the beginning of the build process. (You can check the success of a build (prior to publishing) by pointing 'Load unpacked extension' from chrome://extensions to the `dist/` subdir.)
1. Follow instructions in secrets for actually publishing to the Chrome store.
1. Fill out the release notes for the tag on GitHub and attach `dist.zip` to your notes. This is so that if you built for the development Chrome store, you can then distribute the same `dist.zip` to the production Chrome store without having to rebuild everything. If the tag is known to *not* be a release candidate, mark it as a pre-release.
