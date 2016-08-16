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

/* global chrome */


// things to store:
// username/pw, remember me checkbox for: tidepool
// information for individual devices is stored by device ID
// default server
// timezone

var contexts = [ 'page' ];

var contextMenus = [
  {
    type: 'normal',
    id: 'MENUROOT',
    title: 'Server',
    contexts: contexts
  },
  {
    type: 'radio',
    id: 'Local',
    title: 'Local',
    contexts: contexts,
    parentId: 'MENUROOT',
    checked: false
  },
  {
    type: 'radio',
    id: 'Development',
    title: 'Development',
    contexts: contexts,
    parentId: 'MENUROOT',
    checked: false
  },
  {
    type: 'radio',
    id: 'Clinic',
    title: 'Clinic',
    contexts: contexts,
    parentId: 'MENUROOT',
    checked: false
  },
  {
    type: 'radio',
    id: 'Staging',
    title: 'Staging',
    contexts: contexts,
    parentId: 'MENUROOT',
    checked: false
  },
  {
    type: 'radio',
    id: 'Integration',
    title: 'Integration',
    contexts: contexts,
    parentId: 'MENUROOT',
    checked: false
  },
  {
    type: 'radio',
    id: 'Production',
    title: 'Production',
    contexts: contexts,
    parentId: 'MENUROOT',
    checked: true
  }
];

function setServer(window, info) {
  var serverdata = {
    Local: {
      API_URL: 'http://localhost:8009',
      UPLOAD_URL: 'http://localhost:9122',
      DATA_URL: 'http://localhost:8077',
      BLIP_URL: 'http://localhost:3000'
    },
    Development: {
      API_URL: 'https://dev-api.tidepool.org',
      UPLOAD_URL: 'https://dev-uploads.tidepool.org',
      DATA_URL: 'https://dev-api.tidepool.org/platform',
      BLIP_URL: 'https://dev-blip.tidepool.org'
    },
    Clinic: {
      API_URL: 'https://dev-clinic-api.tidepool.org',
      UPLOAD_URL: 'https://dev-clinic-uploads.tidepool.org',
      DATA_URL: 'https://dev-clinic-api.tidepool.org/platform',
      BLIP_URL: 'https://dev-clinic-blip.tidepool.org'
    },
    Staging: {
      API_URL: 'https://stg-api.tidepool.org',
      UPLOAD_URL: 'https://stg-uploads.tidepool.org',
      DATA_URL: 'https://stg-api.tidepool.org/platform',
      BLIP_URL: 'https://stg-blip.tidepool.org'
    },
    Integration: {
      API_URL: 'https://int-api.tidepool.org',
      UPLOAD_URL: 'https://int-uploads.tidepool.org',
      DATA_URL: 'https://int-api.tidepool.org/platform',
      BLIP_URL: 'https://int-blip.tidepool.org'
    },
    Production: {
      API_URL: 'https://api.tidepool.org',
      UPLOAD_URL: 'https://uploads.tidepool.org',
      DATA_URL: 'https://api.tidepool.org/platform',
      BLIP_URL: 'https://blip.tidepool.org'
    }
  };

  console.log('will use', info.menuItemId, 'server');
  var serverinfo = serverdata[info.menuItemId];
  window.api.setHosts(serverinfo);
}


chrome.app.runtime.onLaunched.addListener(function(launchData) {
  // launchData.url, if it exists, contains the link clicked on by
  // the user in blip. We could use it for login if we wanted to.
  console.log('launchData: ', launchData);
  var token = null;
  if (launchData.id && launchData.id === 'open_uploader') {
    var pat = /^[^?]+\?(.*)/;
    var query = launchData.url.match(pat)[1];
    if (query) {
      var parms = query.split('&');
      for (var p=0; p<parms.length; ++p) {
        var s = parms[p].split('=');
        console.log(s);
        if (s[0] === 'token') {
          token = s[1];
          break;
        }
      }
    }
    if (token) {
      console.log('got a token ', token);
      // now save the token where we can use it
    }
  }

  // Center window on screen.
  var screenWidth = screen.availWidth;
  var screenHeight = screen.availHeight;
  var width = 650;
  var height = 710;

  chrome.app.window.create('index.html', {
    id: 'tidepoolUniversalUploader',
    innerBounds: {
      width: width,
      height: height,
      left: Math.round((screenWidth-width)/2),
      top: Math.round((screenHeight-height)/2),
      minWidth: width,
      minHeight: height
    }
  }, function(createdWindow) {
    /*
    FIXME
    for (var i=0; i<contextMenus.length; ++i) {
      // In version 42 of Chrome, the create call throws an exception when the
      // app is reloaded after being closed (but Chrome itself continues to run).
      // I can't find anything wrong with the code or a way to prevent the
      // exception from occurring.
      // However, catching the exception and ignoring it allows things to
      // proceed, and the app still seems to be working properly -- the menu
      // items still work, etc.
      try {
        chrome.contextMenus.create(contextMenus[i], function()
          {
            var err = chrome.runtime.lastError;
            if (err) {
              console.log('Error creating menu item #', i, ', "', err, '"');
            }
          });
      } catch (exception) {
        // Leaving this here and commented out because it seems to be a bug
        // in Chrome that's causing the exception.
        // console.log('Caught exception in case ', i);
      }
    }

    var menucb = setServer.bind(null, createdWindow.contentWindow);
    chrome.contextMenus.onClicked.addListener(menucb);
    */

    createdWindow.show();
    //createdWindow.contentWindow.localSave = function() {};
    //createdWindow.contentWindow.localLoad = function() {};
  });
});
