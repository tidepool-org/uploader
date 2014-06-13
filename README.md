# Tidepool Uploader

These notes were written on Thursday, June 12, 2014. 

This is a Chrome App that acts as an uploader client for Tidepool. It is intended to allow you to plug devices into the USB port and automatically load the data stored on it up to the Tidepool cloud. 

This is experimental and hacky code and in no way intended to be used for therapy!

## What it has:

### A simple Chrome App
* Has an HTML page, and css files and a rudimentary UI
* Has a manifest that asks for appropriate permissions on installation (someday the permissions should be dynamic based on your devices)
* Is ugly.

### Can talk to the Tidepool Platform
* Displays a UI for you to enter your username and password
* Will log you in to your account on the Tidepool platform (and has a selector for local/dev/staging/prod).
* Gets a token after login allowing uploads
* Can upload one or several CGM readings to the platform

### Has code to manage various USB devices
* It can enumerate the USB devices it knows about
  * Dexcom G4
  * Asante SNAP
  * An Arduino test board
  * A couple of other USB things just used for testing

### Can manage serial communications
* Knows how to talk to serial devices using the Chrome serial API and has
a useful amount of intelligence about how to communicate in packets and the like. It turns out that the Asante and Dexcom protocols are relatively similar if you squint a bit.
* Can enumerate serial ports and make a reasonable guess as to which one is the diabetes device based on the port name.
* Has some utilities for building and disassembling byte-oriented packets of data and calculating CRCs.

### Is starting to know how to talk to a Dexcom
* It has the ability to get firmware data and to query pages of EGV data
* It can interpret that data well enough to post it to Tidepool
* Has a collection of tools for managing Dexcom communications

### Has a pile of code to talk to an Animas SNAP pump
* But because of a cabling issue, none of it's been tested

### Has a little bit of code to talk to block mode devices
* But none of them have come up yet.

## What it's missing

* Integration -- the bits and pieces don't really work together yet. It's basically a lightly-organized collection of hacks.
* Organization -- I did say "lightly" organized. It's not awful code, and parts of it are pretty good, but lots more needs doing
* Adequate code documentation and testing

## How to set it up

1. Clone this repository from github.
1. Open Chrome. Go to chrome://extensions and turn on Developer mode (checkbox on the top line). 
1. Click "Load Unpacked Extension". 
1. Choose the directory you checked out above and click OK.
1. To run it, you can choose "Launch" from the chrome://extensions page. You can also run it from the Chrome App Launcher, which Chrome may install for you whether you want it or not.
1. If you're developing, you may find that the only way it runs properly is to hit "Reload" after each change to the source. You will definitely need to reload any time you change the manifest.

## How to use it

* Plug your Dexcom device in to a USB port first, before you run the app
* Run the app
* Log in
* Press the Upload button
* If you want to be able to test multiple uploads, use the Last Page box to set a number of the most recent pages of data NOT to upload. The dexcom keeps BG data in pages of 38 entries each, so if you put "10" in this box, 380 entries will be saved. Next time you run it, if you put 10 in again, no entries will be uploaded because they've already been done. If you put 9 in, the next batch of 38 will go up, and so on.

