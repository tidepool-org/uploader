# Tidepool Uploader


[![CircleCI](https://circleci.com/gh/tidepool-org/uploader/tree/master.svg?style=shield)](https://circleci.com/gh/tidepool-org/uploader/tree/master)


This is an [Electron App](https://electron.atom.io/) that acts as an uploader client for Tidepool. It is intended to allow you to plug diabetes devices into your computer's USB port, read the data stored on them, and upload a standardized version of the data to the Tidepool cloud.

This README is focused on just the details of getting the uploader running locally. For more detailed information aimed at those working on the development of the uploader, please see the [developer guide](docs/StartHere.md).

#### Table of contents

- [Set Up](#how-to-set-it-up)
- [Config](#config)
- [Tests](#tests)
- [Linting & Code Style](#linting--code-style)
- [Docs](#docs)
- [Publishing](#publishing)
- [Use of LGPL libraries](#use-of-lgpl-libraries)

* * * * *

## How to set it up

1. Clone this repository.
1. Make sure you have node v12.x installed. If you are managing node installations with [`nvm`](https://github.com/creationix/nvm 'GitHub: nvm'), which we **highly recommend**, you can just do `nvm use` when navigating to this repository to switch to the correct version of node. (In this repository, the correct version of node will always be the version of node packaged by the version of Electron that we are using and specified in the `.nvmrc` file.)
1. Run `npm install` or, preferably, `yarn`
1. Set the config for the environment you want to target (see [Config](#config) below)
1. Run the following command:
```bash
$ npm run dev
```
or
```bash
$ yarn dev
```
(This will bundle the application with webpack and watch for changes. When it stops printing output you can continue to the next step.)

**NB:** React components and CSS will hot load after changes (this can be confirmed by watching the JavaScript console), but changes to device drivers and other code outside of the React components will not - use 'Reload' to reload after such changes. If the compilation/hot reload of a component fails for any reason (e.g. from a syntax error) you may need to reinitialize the hot loader by reloading the application.

### Docker for Linux

If you are running Linux you probably need to be using an Ubuntu distribution or derivative. To get around this for other distrubutions you can try to build a local docker image which is based on Ubuntu 18.04 and use the yarn/npm commands interactively.

**NOTE:** You need to add udev rules to your host for uploads to actually work. You can find the udev rules [here](resources/linux/51-tidepool-uploader.rules). The file should be placed in `/etc/udev/rules.d/` and the host should be rebooted.


1. Build the image
    `docker-compose build`

2. Run it
    `docker-compose up -d`

3. Work with it interactively.

    Even if you kill the Tidepool Uploader GUI the container will continue to run. You can work with the yarn commands like you would locally by using docker exec.

    **Examples**

    Interactively select the yarn target: `docker exec -it uploader bash -c "yarn run"`

    Rebuild: `docker exec -it uploader bash -c "yarn build"`

    Start the Dev GUI: `docker exec -it uploader bash -c "yarn dev"`

## Config

Configuration values (for example the URL of the Tidepool Platform) are set via environment variables. If you need to add a config value, modify the `.config.js` file. If you need to read a config value inside the app, use `var config = require('./lib/config')`. To set config values (do this before building the app), you can use Shell scripts that export environment variables (see config/local.sh for an example that exports the appropriate variables when [running the whole Tidepool platform locally using runservers](http://developer.tidepool.org/starting-up-services/)), for example:

```bash
$ source config/local.sh
$ yarn start
```

### Debug Mode(s)

For ease of development we have several debug features that developers can turn on and off at will (and to suit various development use cases, such as working on a new device driver versus working on the app's UI). Each of these debug features is set with an environment variable, but rather than being loaded through `.config.js` (as we do for production configuration variables, see above), we load these through the webpack `DefinePlugin` (see [Pete Hunt's webpack-howto](https://github.com/petehunt/webpack-howto#6-feature-flags) for an example, although note Hunt uses the term 'feature flag').

#### `DEBUG_ERROR`

The environment variable `DEBUG_ERROR` (boolean) controls whether or not errors sourced in device drivers are caught and an error message displayed in the UI (the production setting) or whether they are thrown in the console (much more useful for local development because then the file name and line number of the error are easily accessible, along with a stack trace). `DEBUG_ERROR` mode is turned on by default in `config/device-debug.sh`.

This can also be toggled internally in the running Electron app via a right-click context menu available on the login screen, much like the menu for switching environments.

### Local Development w/o Debug Mode(s)

All debug options are turned *off* by default in `config/local.sh`.

## Tests

To run the tests in this repository as they are run on CircleCI use:

```bash
$ yarn test
```
or
```bash
$ yarn test
```

## Linting & Code Style

We use [ESLint](http://eslint.org/) to lint our JavaScript code. We try to use the same linting options across all our client apps, but there are a few exceptions in this application, noted with comments in the `.eslintrc` configuration file.

To run the linter (which also runs on CircleCI with every push, along with `npm test`), use:

```
$ npm run lint
```

Aside from the (fairly minimal) JavaScript code style options we *enforce* through the linter, we ask that internal developers and external contributors try to match the style of the code in each module being modified. New modules should look to similar modules for style guidance. In React component code, use existing ES6/ES2015 components (not legacy ES5 components) as the style model for new components.

**NB: Please keep ES5 and ES6/ES2015 code distinct. Do *NOT* use ES6/ES2105 features in ES5 modules (most easily recognizable by the use of `require` rather than `import`).**

## Docs

Docs reside in several places in this repository, such as `docs/` and `lib/drivers/docs`. They are built as a static site with [GitBook](https://www.gitbook.com/ 'GitBook') and served at [developer.tidepool.org](http://developer.tidepool.org/) via [GitHub Pages](https://pages.github.com/ 'GitHub Pages').

See [this guidance on our use of GitBook at Tidepool](http://developer.tidepool.org/docs/).

## Publishing

This section is Tidepool-specific. Release management and application updates are handled via the Github provider in the `electron-builder` project. The recommended workflow for a new production release is as follows:

1. When you're working on what might become a new release, increment the version number in `package.json` and `app/package.json` and commit/push (on the branch)
1. The CI server will create a draft release in Github with the title of the version from the `package.json` file and will automatically attach the distribution artifacts to that draft (drafts are not publicly visible)
1. When your pull request is approved and merged to `master`, go to the draft release and type in the version for the tag name, ensure that you're targeting the `master` branch, fill out the release notes and publish the release. This will create the tag for you.

For a non-production release (alpha, dev, etc.)

1. Increment the version number in `package.json` and `app/package.json` and ensure that you have included the channel information after the version patch number (i.e. `v0.304.0-alpha` or `v0.304.0-beta.2`). The hyphen separated version semantic is important.
1. The CI server(s) will create a draft release in Github with the title of the version from the `package.json` file and will automatically attach the distribution artifacts to that draft (drafts are not publicly visible)
1. When you want to publish your non-production release, go to your draft and type in the version for the tag name, ensure that you're targeting the branch that you're currently releasing from, mark the release as a `pre-release`, fill out the release notes and publish the release. This will create the tag for you on the branch that you want.

The Uploader has a self-update mechanism that will look at the latest release and compare versions, downloading and prompting the user to update if a newer version is available. For production releases, only official releases will be considered. For non-production releases (`-alpha`, `-beta.2`, etc.) releases marked as `pre-release` will also be checked, matching against the string portion of the post-hyphen version segment. For more detail about this behavior see [the electron-builder docs concerning auto-update options]( https://github.com/electron-userland/electron-builder/wiki/Auto-Update#appupdater--internaleventemitter)

### CI server environment variables

We use the following environment variables on the CI server:

| Variable | OS Image | Use |
|----------|-----------|-------|
| APPLEID                  | MacOS    | Notarization |
| APPLEIDPASS              | MacOS    | Notarization |
| AWS_ACCESS_KEY_ID        | Both     | S3 builds and AV e-mails |
| AWS_SECRET_ACESS_KEY     | Both     | S3 builds and AV e-mails |
| CSC_FOR_PULL_REQUEST     | Both     | `true`, code signing for PR |
| CSC_KEY_PASSWORD         | MacOS    | Certificate password |
| CSC_LINK                 | MacOS    | Code signing certificate |
| WIN_CSC_KEY_PASSWORD     | Windows  | Certificate password |
| WIN_CSC_LINK             | Windows  | Code signing certificate |
| DEBUG                    | MacOS    | Set to `electron-builder` |
| GH_TOKEN                 | Both     | For GitHub builds |
| PUBLISH_FOR_PULL_REQUEST | Both     | `true`, build artefact for PR |
| ROLLBAR_POST_TOKEN       | Both     | Rollbar logging |
| FTP_AV_PASSWORD_TIDEPOOL | Windows  | AV submission |

## Editor Configuration
**Atom**
```bash
apm install editorconfig es6-javascript javascript-snippets linter linter-eslint language-babel autocomplete-modules file-icons
```

**Sublime**
* [Editorconfig Integration](https://github.com/sindresorhus/editorconfig-sublime#readme)
* [Linting](https://github.com/SublimeLinter/SublimeLinter3)
* [ESLint Integration](https://github.com/roadhump/SublimeLinter-eslint)
* [Syntax Highlighting](https://github.com/babel/babel-sublime)
* [Autocompletion](https://github.com/ternjs/tern_for_sublime)
* [Node Snippets](https://packagecontrol.io/packages/JavaScript%20%26%20NodeJS%20Snippets)
* [ES6 Snippets](https://packagecontrol.io/packages/ES6-Toolkit)

**Others**
* [Editorconfig](http://editorconfig.org/#download)
* [ESLint](http://eslint.org/docs/user-guide/integrations#editors)
* Babel Syntax Plugin

## DevTools

#### Toggle Chrome DevTools

- OS X: <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>I</kbd> or <kbd>F12</kbd>
- Linux: <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>I</kbd> or <kbd>F12</kbd>
- Windows: <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>I</kbd> or <kbd>F12</kbd>

*See [electron-debug](https://github.com/sindresorhus/electron-debug) for more information.*

#### DevTools extension

This project includes the following DevTools extensions:

* [Devtron](https://github.com/electron/devtron) - Install via [electron-debug](https://github.com/sindresorhus/electron-debug).
* [React Developer Tools](https://github.com/facebook/react-devtools) - Install via [electron-devtools-installer](https://github.com/GPMDP/electron-devtools-installer).
* [Redux DevTools](https://github.com/zalmoxisus/redux-devtools-extension) - Install via [electron-devtools-installer](https://github.com/GPMDP/electron-devtools-installer).

You can find the tabs on Chrome DevTools.

If you want to update extensions version, please set `UPGRADE_EXTENSIONS` env, just run:

```bash
$ UPGRADE_EXTENSIONS=1 npm run dev

# For Windows
$ set UPGRADE_EXTENSIONS=1 && npm run dev
```

## CSS Modules

All `.module.less` files will be use css-modules.

## Packaging

To package apps for the local platform:

```bash
$ npm run package
```
```bash
$ yarn package
```

To package apps with options:

```bash
$ npm run package -- --[option]
```

To package the app on your local machine, you need to set the `ROLLBAR_POST_TOKEN` environment variable to send telemetry data to Rollbar. You can get one for free from https://rollbar.com

macOS: To notarize the app so that it will run on macOS Mojave, you need to set the environment variables `APPLEID` and `APPLEIDPASS`. Note that you need to set an app-specific password in https://appleid.apple.com for this to work.

Note that you'll need to build Windows builds on a Windows machine, and MacOS builds on a Mac.

## Further commands

To run the application without packaging run

```bash
$ npm run build
$ npm start
```

To run End-to-End Test

```bash
$ npm run build
$ npm run test-e2e
```

#### Options

See [electron-builder CLI Usage](https://github.com/electron-userland/electron-builder#cli-usage)

#### Module Structure

This project uses a [two package.json structure](https://github.com/electron-userland/electron-builder/wiki/Two-package.json-Structure).

1. If the module is native to a platform or otherwise should be included with the published package (i.e. bcrypt, openbci), it should be listed under `dependencies` in `./app/package.json`.
2. If a module is `import`ed by another module, include it in `dependencies` in `./package.json`.   See [this ESLint rule](https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-extraneous-dependencies.md).
3. Otherwise, modules used for building, testing and debugging should be included in `devDependencies` in `./package.json`.

## Use of LGPL libraries

Tidepool Uploader makes use of the following LGPL-licensed libraries:

- libmtp (http://libmtp.sourceforge.net/)
- LZO implementation in libavutil, which is part of FFmpeg (https://github.com/FFmpeg/FFmpeg/tree/master/libavutil)

These libraries are used in the following Node.js modules created by Tidepool and are dependencies of the Tidepool Uploader:

- https://github.com/tidepool-org/node-mtp (libmtp)
- https://github.com/tidepool-org/lzo-decompress (libavutil)

The LGPL is intended to allow use of libraries in applications that don’t necessarily distribute the source of the application. The LGPL has two requirements:

- users must have access to the source code of the library
- users can make use of modified versions of the library

To satisfy (1) we provide links to the relevant code repositories. To satisfy (2) we dynamically link to the library, so that it’s possible to swap it out for another version of the library.

### Impact on Tidepool

Compile FFmpeg ourselves to ensure that we’re using the LGPL version and only include the minimal set of libraries
Use dynamic linking (e.g. on Windows this means using a .dll, and on MacOS a .dylib) when linking to these libraries
Mention that the software uses libraries from the FFmpeg project and libmtp under the LGPLv3, e.g. `This software uses code of <a href=http://ffmpeg.org>FFmpeg</a> and <a href=”http://libmtp.sourceforge.net/”>libmtp</a> licensed under the <a href=a href=https://www.gnu.org/licenses/lgpl.html>LGPLv3</a> and its source can be downloaded <a href=”https://github.com/FFmpeg/FFmpeg/tree/master/libavutil”>here</a> and <a href=”https://sourceforge.net/projects/libmtp/”>here</a>`


### Impact on 3rd parties

If your EULA claims ownership over the code, you have to explicitly mention that you do not own FFmpeg or libmtp, and where the relevant owners can be found.


### References

- [LGPL v3 License Text](https://www.gnu.org/licenses/lgpl.html) (on gnu.org)
- [LGPL on Wikipedia](https://en.wikipedia.org/wiki/GNU_Lesser_General_Public_License)
