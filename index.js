// buildUI.js
// this constructs the UI in jQuery

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

var $ = require('jquery');
window.jQuery = $;
var async = require('async');
var timeutils = require('./lib/timeutils.js');
var util = require('util');
var _ = require('lodash');

require('./js/bootstrap.js');
require('./css/bootstrap.css');
require('./css/bootstrap-theme.css');
require('./styles/custom.css');

// these are the settings that are stored in local storage
var settings = {};

var make_base_auth = function (username, password) {
  var tok = username + ':' + password;
  var hash = btoa(tok);
  return 'Basic ' + hash;
};

var tidepoolHosts = {
  local: { 
    host: 'http://localhost:8009', 
    jellyfish: 'http://localhost:9122',
    blip: 'http://localhost:3000'
  },
  devel: { 
    host: 'https://devel-api.tidepool.io', 
    jellyfish: 'https://devel-uploads.tidepool.io',
    blip: 'https://blip-devel.tidepool.io'
  },
  staging: { 
    host: 'https://staging-api.tidepool.io', 
    jellyfish: 'https://staging-uploads.tidepool.io',
    blip: 'https://blip-staging.tidepool.io'
  },
  prod: { 
    host: 'https://api.tidepool.io', 
    jellyfish: 'https://uploads.tidepool.io',
    blip: 'https://blip-ucsf-pilot.tidepool.io'
  }
};

var tidepoolServerData = {
  host: '',
  jellyfish: '',
  usertoken: '',
  userdata: null,
  isLoggedIn: false
};

var storageDeviceInfo = {};

var tidepoolServer = {
  get: function (url, happycb, sadcb) {
    $.ajax({
      type: 'GET',
      url: url,
      headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
    }).success(function (data, status, jqxhr) {
      var tok = jqxhr.getResponseHeader('x-tidepool-session-token');
      if (tok && tok != tidepoolServerData.usertoken) {
        tidepoolServerData.usertoken = tok;
      }
      happycb(data, status, jqxhr);
    }).error(function (jqxhr, status, err) {
      sadcb(jqxhr, status, err);
    });
  },
  post: function (url, data, happycb, sadcb) {
    $.ajax({
      type: 'POST',
      url: url,
      contentType: 'application/json',
      data: JSON.stringify(data),
      headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
    }).success(function (data, status, jqxhr) {
      var tok = jqxhr.getResponseHeader('x-tidepool-session-token');
      if (tok && tok != tidepoolServerData.usertoken) {
        tidepoolServerData.usertoken = tok;
      }
      happycb(data, status, jqxhr);
    }).error(function (jqxhr, status, err) {
      sadcb(jqxhr, status, err);
    });
  },
  login: function (username, password, happycb, sadcb) {
    var url = tidepoolServerData.host + '/auth/login';
    $.ajax({
      type: 'POST',
      url: url,
      headers: { 'Authorization': make_base_auth(username, password) }
    }).success(function (data, status, jqxhr) {
      tidepoolServerData.usertoken = jqxhr.getResponseHeader('x-tidepool-session-token');
      tidepoolServerData.userdata = data;
      happycb(data, status, jqxhr);
    }).error(function (jqxhr, status, err) {
      sadcb(jqxhr, status, err);
    });
  },
  getProfile: function (happycb, sadcb) {
    var url = tidepoolServerData.host + '/metadata/' + tidepoolServerData.userdata.userid + '/profile';
    this.get(url, happycb, sadcb);
  },
  getUploadAccounts: function (happycb, sadcb) {
    var url = tidepoolServerData.host + '/access/groups/' + tidepoolServerData.userdata.userid;
    this.get(url, happycb, sadcb);
  },
  postToJellyfish: function (data, happycb, sadcb) {
    var url = tidepoolServerData.jellyfish + '/data';
    this.post(url, data, happycb, sadcb);
  }
};

var jellyfish = require('./lib/jellyfishClient.js')({tidepoolServer: tidepoolServer});
var builder = require('./lib/objectBuilder.js')();
var serialDevice = require('./lib/serialDevice.js');
var driverManager = require('./lib/driverManager.js');

function constructUI() {
  //$('body').append('This is a test.');

  var currentUIState = '.state_login';
  $('.state_login').hide();
  $('.state_upload').hide();
  $('.state_settings').hide();
  function setUIState(newstate) {
    $(currentUIState).fadeOut(400, function () {
      $(newstate).fadeIn();
      currentUIState = newstate;
    });
  }

  setUIState('.state_login');

  function connected (isConnected) {
    if (isConnected) {
      $('.showWhenNotConnected').fadeOut(400, function () {
        $('.showWhenConnected').fadeIn();
      });
    } else {
      $('.showWhenConnected').fadeOut(400, function () {
        $('.showWhenNotConnected').fadeIn();
      });
    }
  }

  connected(true);

  // displays text on the connect log
  function connectLog (s) {
    if (s[s.length - 1] !== '\n') {
      s += '\n';
    }
    // var all = $('#connectionLog').val();
    // $('#connectionLog').val(all + s);
    console.log(s);
  }

  $('#loginButton').click(function () {
    var username = $('#username').val();
    var password = $('#password').val();
    var serverIndex = $('#serverURL').val();
    var myuserid = null;
    var myfullname = null;
    // console.log(username, password, serverIndex);
    tidepoolServerData.host = tidepoolHosts[serverIndex].host;
    tidepoolServerData.jellyfish = tidepoolHosts[serverIndex].jellyfish;

    function goodUpload (data, status, jqxhr) {
      connectLog(status);
      connectLog(util.format('%j', data));
      var otherusers = _.omit(data, myuserid);
      $('#uploadOptions')
      .append($('<option></option>')
        .attr('value', '0')
        .text(myfullname));
      if (otherusers != {}) {
        var otherids = _.keys(otherusers);
        _.each(otherids, function(otherid) {
          $('#uploadOptions')
          .append($('<option></option>')
            .attr('value', '0')
            .text('User ' + otherid));
        });
      }
    }

    function failUpload (jqxhr, status, error) {
      connectLog('FAILED getting upload info!', status, error);
    }

    function getUploadAccounts () {
      connectLog('Fetching upload info.');
      tidepoolServer.getUploadAccounts(goodUpload, failUpload);
    }

    function goodProfile (data, status, jqxhr) {
      connectLog(status);
      connectLog(util.format('%j', data));
      myfullname = data.fullName;
      $('.loginname').text(myfullname);
      getUploadAccounts();
    }

    function failProfile (jqxhr, status, error) {
      connectLog('FAILED fetching profile!', status, error);
    }

    function getProfile () {
      connectLog('Fetching profile.');
      tidepoolServer.getProfile(goodProfile, failProfile);
    }

    function goodLogin (data, status, jqxhr) {
      console.log(data);
      // if the user wanted their data saved, save it now that we proved they can log in
      if ($('#rememberme').prop('checked')) {
        var f = window.localSave;
        var obj = {
          tidepool: {
            username: username,
            password: password,
            remember_me: true,
          },
          defaultServer: $('serverURL').val()
        };
        f(obj);
      } else {
        // if remember me is NOT checked, make sure that we don't have any saved data
        window.localSave({
          tidepool: {
            username: '', 
            password: '', 
            remember_me: false
          },
          defaultServer: $('serverURL').val()
        });
      }
      myuserid = data.userid;
      connectLog(status);
      getProfile();
      setUIState('.state_upload');
    }

    function failLogin (jqxhr, status, error) {
      console.log('Login failed.');
      connectLog('Login failed.'); // don't display status -- it includes password!
      $('.loginstatus').text('Login failed');
      setUIState('.state_login');
    }

    tidepoolServer.login(username, password, goodLogin, failLogin);
  });

  $('#logoutButton').click(function () {
    setUIState('.state_login');
  });

  $('#settingsButton').click(function () {
    setUIState('.state_settings');
  });


// have a list of previously active devices
// get a list of possible devices
// generate a list of currently active devices
// diff the lists
// remove active from possible
// check active devices and remove any not found
// check remaining possible and add them to actives if found

  var activeDeviceIDs = [];
  var forceDeviceIDs = [];

  function getDeviceManifest(dev) {
    var manifest = chrome.runtime.getManifest();
    for (var i=0; i<manifest.permissions.length; ++i) {
      if (manifest.permissions[i].usbDevices) {
        if (dev == null) {
          return manifest.permissions[i].usbDevices;
        } else {
          return manifest.permissions[i].usbDevices[dev];
        }
      }
    }
    return null;
  }

  function scanUSBDevices () {
    // first, find the part of the manifest that talks about the devices
    // The manifest isn't very flexible about letting us define a section
    // for our own use, so we use the permissions block

    var alldevs = getDeviceManifest();
    var devices = {};
    _.each(alldevs, function(d) {
      devices[d.driverId] = d;
    });

    // this is the list of devices we could possibly plug in
    var possibleDeviceIDs = _.keys(devices);

    // build a list of the devices that are actually plugged in
    var foundDevices = forceDeviceIDs.slice();
    function foundDevice(id, chromeDevicesFound) {
      if (chromeDevicesFound.length > 0) {
        foundDevices.push(id);
      }
    }
    _.each(possibleDeviceIDs, function(id) {
      var f = foundDevice.bind(null, id);
      chrome.usb.getDevices({
        vendorId: devices[id].vendorId,
        productId: devices[id].productId
      }, f);
    });

    // give the getDevices call time to work
    setTimeout(function() {
      // console.log('activeDeviceIDs: ', activeDeviceIDs);
      // removes is the list of devices that were unplugged

      // there could be dups in foundDevices; that's ok, just eliminate them
      foundDevices = _.unique(foundDevices);

      var removes = _.difference(activeDeviceIDs, foundDevices);
      _.each(removes, function(v) {
        $('.' + v).hide();
      });

      // newdevices is the list of devices that were added
      var newdevices = _.difference(foundDevices, activeDeviceIDs);
      _.each(newdevices, function(v) {
        $('.' + v).show();
      });

      // now we can update the list of current devices
      activeDeviceIDs = foundDevices;
    }, 1000);
  }

  setInterval(scanUSBDevices, 5000);

  // $('#getDevices').click(scanUSBDevices);  

  chrome.system.storage.onAttached.addListener(function (info) {
    connectLog('attached: ' + info.name);
    storageDeviceInfo[info.id] = {
      id: info.id,
      name: info.name,
      type: info.type
    };
    console.log(storageDeviceInfo[info.id]);
    // whenever someone inserts a new device, try and run it
    scanUSBDevices();
  });

  chrome.system.storage.onDetached.addListener(function (id) {
    connectLog('detached: ' + storageDeviceInfo[id].name);
    delete(storageDeviceInfo[id]);
  });

  var asanteDriver = require('./lib/asanteDriver.js');
  var dexcomDriver = require('./lib/dexcomDriver.js');

  var serialDevices = {
    'AsanteSNAP': asanteDriver,
    'DexcomG4': dexcomDriver,
  };

  var serialConfigs = {
    'AsanteSNAP': {
      deviceComms: serialDevice(),
      timeutils: timeutils,
      timezone: $('#timezone').val(),
      jellyfish: jellyfish,
      builder: builder,
      progress_bar: '.AsanteSNAP .progress-bar',
      status_text: '.AsanteSNAP .status'
    },
    'DexcomG4': {
      deviceComms: serialDevice(),
      timeutils: timeutils,
      timezone: $('#timezone').val(),
      jellyfish: jellyfish,
      builder: builder,
      progress_bar: '.DexcomG4 .progress-bar',
      status_text: '.DexcomG4 .status'
    }
  };

  var insuletDriver = require('./lib/insuletDriver.js');
  var blockDevices = {
    'InsuletOmniPod': insuletDriver
  };

  var uploaders = {
    'Carelink': require('./lib/carelink/carelinkDriver.js')(require('./lib/simulator/pwdSimulator.js')(jellyfish))
  };

  function doUploads(driverNames, driverObjects, driverConfigs, cb) {
    var dm = driverManager(driverObjects, driverConfigs);
    var devices = [];
    for (var idx = 0; idx < driverNames.length; ++idx) {
      devices.push(dm.process.bind(dm, driverNames[idx]));
    }
    async.series(devices, cb);
  }

  function uploadSerial() {
    var allSerial = _.keys(serialDevices);
    var uploads = _.intersection(allSerial, activeDeviceIDs);
    console.log('Uploading for ', uploads);
    doUploads(uploads, serialDevices, serialConfigs, function (err, results) {
      console.log('uploads complete!');
      console.log(err);
      console.log(results);
    });
  }

  function handleFileSelect (evt) {
    var files = evt.target.files;
    // can't ever be more than one in this array since it's not a multiple
    var i = 0;
    if (files[i].name.slice(-4) == '.ibf') {
      var reader = new FileReader();

      reader.onerror = function (evt) {
        console.log('Reader error!');
        console.log(evt);
      };

      // closure to bind the filename
      reader.onloadend = (function (theFile) {
        return function (e) {
          // console.log(e);
          var cfg = {
            'InsuletOmniPod': {
              filename: theFile.name,
              filedata: e.srcElement.result,
              timeutils: timeutils,
              timezone: $('#timezone').val(),
              jellyfish: jellyfish,
              builder: builder,
              progress_bar: '.InsuletOmniPod .progress-bar',
              status_text: '.InsuletOmniPod .status'

            }
          };
          doUploads(['InsuletOmniPod'], blockDevices, cfg, function (err, results) {
            if (err) {
              connectLog('Some sort of error occurred (see console).');
              console.log('Fail');
              console.log(err);
              console.log(results);
            } else {
              connectLog('Data was successfully uploaded.');
              console.log('Success');
              console.log(results);
            }
          });
        };
      })(files[i]);

      reader.readAsArrayBuffer(files[i]);
    }
  }

  $('#signup').click(function () {
    var serverIndex = $('#serverURL').val();
    window.open(tidepoolHosts[serverIndex].blip);
  });
  $('#realUploadButton').change(handleFileSelect);

  $('#buttonUpload').click(uploadSerial);

  function handleCarelinkFileSelect(evt) {
    console.log('Carelink file selected', evt);
    var file = evt.target.files[0];

    // can't ever be more than one in this array since it's not a multiple
    var reader = new FileReader();

    reader.onerror = function (evt) {
      console.log('Reader error!');
      console.log(evt);
    };

    reader.onloadend = function (e) {
      // console.log(e);
      var cfg = {
        'Carelink': {
          filename: file.name,
          fileData: reader.result,
          timezone: $('#timezone').val()
        }
      };
      doUploads(['Carelink'], uploaders, cfg, function (err, results) {
        if (err) {
          connectLog('Some sort of error occurred (see console).');
          console.log('Fail');
          console.log(err);
          console.log(results);
        } else {
          connectLog('Data was successfully uploaded.');
          console.log('Success');
          console.log(results);
        }
      });
    };

    reader.readAsText(file);
  }

  $('#carelinkFileChooser').change(handleCarelinkFileSelect);

  $('#carelinkButton').click(function(evt){
    console.log('Asked to upload to carelink!');

    var cfg = {
      'Carelink': {
        username: $('#carelinkUsername').val(),
        password: $('#carelinkPassword').val(),
        timezone: $('#timezone').val()
      }
    };
    console.log('cfg: ', cfg);
    doUploads(['Carelink'], uploaders, cfg, function(err, results){
      if (err != null) {
        connectLog('Error when pulling data');
        console.log(err);
        console.log(results);
      } else {
        connectLog('Data successfully uploaded.');
        console.log(results);
      }
    });
  });

  // make sure we don't see the progress bar until we need it
  $('#progress_bar').hide();
  // and make our pretty file button click the ugly one that we've hidden
  $('#omnipodFileButton').click(function () {
    $('#realUploadButton').click();
  });
  connectLog('private build -- Insulet is supported.');

  $('.DexcomG4').hide();
  $('.AsanteSNAP').hide();
  $('.InsuletOmniPod').hide();

  $('#saveSettingsButton').click(function () {
    var ckboxes = [
      'DexcomG4',
      'AsanteSNAP',
      'InsuletOmniPod'
    ];

    var pattern = $('#dexcomPortPattern').val();
    serialConfigs.DexcomG4.deviceComms.setPattern(pattern);
    window.localSave({ dexcomPortPattern: pattern });

    pattern = $('#asantePortPattern').val();
    serialConfigs.AsanteSNAP.deviceComms.setPattern(pattern);
    window.localSave({ asantePortPattern: pattern });

    forceDeviceIDs = [];
    _.each(ckboxes, function(box) {
      if ($('#show' + box).prop('checked')) {
        forceDeviceIDs.push(box);
      }
    });
    window.localSave({ forceDeviceIDs : forceDeviceIDs });
    console.log('forceDeviceIDs', forceDeviceIDs);
    setUIState('.state_upload');
    scanUSBDevices();
  });

  window.addEventListener('load', function () {
    console.log('load was called');
    window.localLoad(null, function(newsettings) {
      settings = newsettings;
      if (settings.tidepool.remember_me === true) {
        $('#username').val(settings.tidepool.username);
        $('#password').val(settings.tidepool.password);
        $('#rememberme').prop('checked', true);
      }
      if (settings.defaultServer) {
        $('#serverURL').val(settings.defaultServer);
      }
      if (settings.timezone) {
        $('#timezone').val(settings.timezone);
      }
      if (settings.dexcomPortPattern) {
        $('#dexcomPortPattern').val(settings.dexcomPortPattern);
        serialConfigs.DexcomG4.deviceComms.setPattern(settings.dexcomPortPattern);
      }
      if (settings.asantePortPattern) {
        $('#asantePortPattern').val(settings.asantePortPattern);
        serialConfigs.AsanteSNAP.deviceComms.setPattern(settings.asantePortPattern);
      }
      if (settings.forceDeviceIDs) {
        _.each(settings.forceDeviceIDs, function(box) {
          $('#show' + box).prop('checked', true);
          forceDeviceIDs = settings.forceDeviceIDs;
        });
      }
      console.log(settings);
    });
  }, false);

}

$(constructUI);
// Uploader needs a timezone selector


