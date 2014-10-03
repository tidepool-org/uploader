# Tidepool Uploader

These notes were updated on Thursday, October 2, 2014. 

_This code is currently out of date. We are waiting for approval from one manufacturer so that the private work we've been doing can be made public. Please check back in a few days for updates._

This is a Chrome App that acts as an uploader client for Tidepool. It is intended to allow you to plug devices into the USB port and automatically load the data stored on it up to the Tidepool cloud. 

This is still experimental code and in no way should it be used for therapy! Until we feel it's ready, the version number will remain less than 1.0. 

## About:

### A simple Chrome App
* Has an HTML page, and css files and a rudimentary UI
* Has a manifest that asks for appropriate permissions on installation (someday the permissions should be dynamic based on your devices)
* Is ugly.

### Can talk to the Tidepool Platform
* Displays a UI for you to enter your username and password
* Will log you in to your account on the Tidepool platform (and has a selector for local/dev/staging/prod).
* Gets a token after login allowing uploads
* Can upload data to the platform

### Has code to manage various USB devices
* It can enumerate the USB devices it knows about
  * Dexcom G4
  * Asante SNAP
  * An Arduino test board
  * A couple of other USB things just used for testing

### Can manage serial communications
* Knows how to talk to serial devices using the Chrome serial API and has
a useful amount of intelligence about how to communicate in packets and the like. It turns out that the Asante and Dexcom serial protocols are relatively similar if you squint a bit.
* Can enumerate serial ports and make a reasonable guess as to which one is the diabetes device based on the port name on a Mac. Probably needs further work on Windows.
* Has some utilities for building and disassembling byte-oriented packets of data and calculating CRCs.

### Can handle selection and upload of a data file from a block mode device
* It can detect insertion of a block mode device, but you must press "Choose File" to bring up the file selection dialog (this is a security measure imposed by Chrome). 

### Is starting to know how to talk to a Dexcom
* It has the ability to get firmware data, manufacturing data, and to query pages of EGV data
* It can interpret that data well enough to post it to Tidepool as CGM records
* Has a collection of tools for managing Dexcom communications
* Is not yet finished

### Has code to talk to an Asante SNAP pump
* It can do scheduled basals, boluses of all types, wizards, and some of the settings
* It does not yet do temp basals, or properly understand basal schedules, and there are probably many edge cases it doesn't do right.

### Insulet OmniPod
* Insulet hasn't allowed us to open source the driver for the Omnipod yet, so it's not in this repository yet. Soon, we hope.

### Time zones
* There is a time zone selector but it has only a few time zones in it. 

## What it's missing

* Adequate code documentation and testing
* A better model to allow us to load drivers dynamically
* A smarter plugin model for serial devices -- it's designed to support dynamic detection and automatic uploading of serial data, but can't dynamically detect serial ports yet.
* A better UI design

## How to set it up

1. Clone this repository from github.
1. Run `npm install`
1. Run `./node_modules/.bin/webpack --progress -d`
1. Open Chrome. Go to chrome://extensions and turn on Developer mode (checkbox on the top line). 
1. Click "Load Unpacked Extension". 
1. Choose the directory you checked out above and click OK.
1. To run it, you can choose "Launch" from the chrome://extensions page. You can also run it from the Chrome App Launcher, which Chrome may install for you whether you want it or not.
1. If you're developing, you may find that the only way it runs properly is to hit "Reload" after each change to the source. You will definitely need to reload any time you change the manifest.

## Known bugs
* You have to have your serial device plugged in before you run it. That will get fixed soonish.
* On a Mac, although the window closes when you click the close button, the icon sticks around and you have to Force Quit it.

## How to use it

### Dexcom
* Plug your Dexcom device in to a USB port first, before you run the app
* Run the app
* Log in
* Press the "Upload from Dexcom" button

### Asante
* You need a cable that Chrome recognizes as a serial cable -- this is a standard FTDI cable. The cable from Asante doesn't work for this system because it uses custom drivers. Talk to us by email or on IRC if you're trying to do it and we can tell you where to buy a generic cable.

Note that Blip doesn't like it much if you don't have at least 24 hours worth of data, although it will work with only CGM data.
