/**
 * Listens for the app launching then creates the window
 *
 * @see http://developer.chrome.com/apps/app.runtime.html
 * @see http://developer.chrome.com/apps/app.window.html
 */

/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */


// things to store:
// username/pw, remember me checkbox for: tidepool
// information for individual devices is stored by device ID
// default server
// timezone

// these are the 'global' values we always want to be available
// you can also save/restore other values (and should, for device details)

var defaultStorage = {
  tidepool: {
    username: '',
    password: '',
    remember_me: false
  },
  defaultServer: 'local',
  timezone: 'America/Los_Angeles',
  dexcomPortPattern: '/dev/cu.usbmodem.+',
  FTDIPortPattern: '/dev/cu.usbserial.+',
  forceDeviceIDs: []
};


function localSave(store, key, object) {
  console.log('calling local save!');
  console.log(object);
  if (object == null || object == '') {
    throw new Error('Save called with null object!');
  }
  store.removeItem('asantePortPattern');
  // chrome.storage.local.remove('user');
  // chrome.storage.local.remove('dexcomPortPrefix');

  //hmm not so sure
  store.setItem('',object);
}

function localLoad(store, object, cb) {
  console.log('calling local load!');
  if (object == null || object == '') {
    return cb(store.getItem(defaultStorage));
  } else {
    console.log('getting ... '+object);
    return cb(store.getItem(object));
  }
}

chrome.runtime.onInstalled.addListener(function() {
  console.log('onInstall was called');
  localLoad(null, function(items) {
    console.log(items);
    for (var i in items) {
      defaultStorage[i] = items[i];
    }
    console.log(defaultStorage);
  });
});

chrome.app.runtime.onLaunched.addListener(function() {
  // Center window on screen.
  var screenWidth = screen.availWidth;
  var screenHeight = screen.availHeight;
  var width = 650;
  var height = 600;

  chrome.app.window.create('index.html', {
    id: 'tidepoolUniversalUploader',
    innerBounds: {
      width: width,
      height: height,
      left: Math.round((screenWidth-width)/2),
      top: Math.round((screenHeight-height)/2),
      minWidth: 600,
      minHeight: 500
    }
  }, function(createdWindow) { 
    createdWindow.contentWindow.localSave = localSave;
    createdWindow.contentWindow.localLoad = localLoad;
  });
});

