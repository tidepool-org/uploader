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

/* global chrome */

var $ = require('jquery');
window.jQuery = $;
var async = require('async');
var timeutils = require('./lib/timeutils.js');
var util = require('util');
var _ = require('lodash');

var api = require('./lib/core/api.js');
var config = require('./lib/config');

require('./js/bootstrap.js');
require('./css/bootstrap.css');
require('./css/bootstrap-theme.css');
require('./styles/custom.css');

// these are the settings that are stored in local storage
var settings = {};
var storageDeviceInfo = {};

var jellyfish = require('./lib/jellyfishClient.js')({tidepoolServer: api});
var builder = require('./lib/objectBuilder.js')();
var serialDevice = require('./lib/serialDevice.js');
var driverManager = require('./lib/driverManager.js');

function constructUI() {
  //$('body').append('This is a test.');

  var doingUpload = false;
  var doingScan = false;
  var showUploadButton = true;
  var showRescanButton = false;


  function updateButtons() {
    if (showUploadButton) {
      $('#buttonUpload').show();
    } else {
      $('#buttonUpload').hide();
    }
    if (showRescanButton) {
      $('#buttonRescan').show();
    } else {
      $('#buttonRescan').hide();
    }
  }

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

    api.init(function(){
      api.user.login({ username: username, password:password}, goodLogin, failLogin);
      function goodUpload (data, status) {
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

      function failUpload (error, status) {
        connectLog('FAILED getting upload info!', status, error);
      }

      function getUploadAccounts () {
        connectLog('Fetching upload info.');
        api.upload.accounts(goodUpload, failUpload);
      }

      function goodProfile (data, status) {
        connectLog(status);
        connectLog(util.format('%j', data));
        myfullname = data.fullName;
        $('.loginname').text(myfullname);
        getUploadAccounts();
      }

      function failProfile (error, status) {
        connectLog('FAILED fetching profile!', status, error);
      }

      function getProfile () {
        connectLog('Fetching profile.');
        api.user.profile(goodProfile, failProfile);
      }

      function goodLogin (data, status) {
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
            defaultServer: $('#serverURL').val()
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
            defaultServer: $('#serverURL').val()
          });
        }
        myuserid = data.userid;
        connectLog(status);
        getProfile();
        setUIState('.state_upload');
      }

      function failLogin (error, status) {
        console.log('Login failed.');
        connectLog('Login failed.');
        $('.loginstatus').text('Login failed');
        setUIState('.state_login');
      }

    });



  });

  $('#logoutButton').click(function () {
    setUIState('.state_login');
  });

  $('#settingsButton').click(function () {
    setUIState('.state_settings');
  });

  // $('#testButton').click(function () {
  //   console.log('testing!');
  //   serialConfigs.OneTouchMini.deviceComms = require('./lib/dummyOneTouchSerial.js')();
  //   var oneTouchMiniDriver = require('./lib/oneTouchMiniDriver.js')(serialConfigs.OneTouchMini);
  //   console.log(oneTouchMiniDriver);
  //   oneTouchMiniDriver.testDriver();
  // });


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

  function displaySelectedDevices() {
    var removes = _.difference(activeDeviceIDs, forceDeviceIDs);
    _.each(removes, function(v) {
      $('.' + v).hide();
    });

    // newdevices is the list of devices that were added
    var newdevices = _.difference(forceDeviceIDs, activeDeviceIDs);
    _.each(newdevices, function(v) {
      $('.' + v).show();
    });

    // now we can update the list of current devices
    activeDeviceIDs = forceDeviceIDs;
    setTimeout(displaySelectedDevices, 10000);
  }

  function scanUSBDevices () {
    // first, find the part of the manifest that talks about the devices
    // The manifest isn't very flexible about letting us define a section
    // for our own use, so we use the permissions block

    if (doingUpload) {
      // they hit the upload button so don't start a scan
      return;
    }

    doingScan = true;
    $('#buttonUpload').attr('disabled', 'disabled');

    var alldevs = getDeviceManifest();
    var devices = {};
    _.each(alldevs, function(d) {
      devices[d.driverId] = d;
    });

    // this is the list of devices we could possibly plug in
    var possibleDeviceIDs = _.keys(devices);

    // now iterate through all the devices and see which ones are plugged in
    async.mapSeries(possibleDeviceIDs, function(id, cb) {
      // this gets called for each possible device
      function foundDevice(id, chromeDevicesFound) {
        if (!_.contains(['block', 'serial', 'FTDI'], devices[id].mode)) {
          return cb(null, null);
        }
        if (chromeDevicesFound.length > 0) {
          if (devices[id].mode === 'FTDI') {
            console.log('looking for ' + id);
            detectFTDIDevice(id, function(err, result) {
              if (err) {
                console.log(id, ' not detected');
                cb(null, null);
              } else {
                console.log(result);
                cb(null, id);
              }
            });
          } else if (devices[id].mode === 'block') {
            cb(null, id);
          } else if (devices[id].mode === 'serial') {
            cb(null, id);
          } else {
            cb(null, null);
          }
        } else {
          cb(null, null);
        }
      }
      var f = foundDevice.bind(null, id);
      chrome.usb.getDevices({
        vendorId: devices[id].vendorId,
        productId: devices[id].productId
      }, f);
    }, function(err, result) {
      // once we've walked all the devices, we add the ones we need to force and then
      // figure out what's changed.
      var foundDevices = _.union(_.compact(result), forceDeviceIDs);
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
      $('#buttonUpload').removeAttr('disabled');
      doingScan = false;

      if (showUploadButton) {
        setTimeout(scanUSBDevices, 10000);
      }
    });
  }

  function startScanning() {
    showUploadButton = true;
    showRescanButton = false;
    updateButtons();
    setTimeout(displaySelectedDevices, 5000);
  }

  // chrome.system.storage.onAttached.addListener(function (info) {
  //   connectLog('attached: ' + info.name);
  //   storageDeviceInfo[info.id] = {
  //     id: info.id,
  //     name: info.name,
  //     type: info.type
  //   };
  //   console.log(storageDeviceInfo[info.id]);
  //   // whenever someone inserts a new device, try and run it
  //   //scanUSBDevices();
  // });

  // chrome.system.storage.onDetached.addListener(function (id) {
  //   connectLog('detached: ' + storageDeviceInfo[id].name);
  //   delete(storageDeviceInfo[id]);
  // });

  var asanteDriver = require('./lib/asanteDriver.js');
  var dexcomDriver = require('./lib/dexcomDriver.js');
  var oneTouchMiniDriver = require('./lib/oneTouchMiniDriver.js');

  var serialDevices = {
    'AsanteSNAP': asanteDriver,
    'DexcomG4': dexcomDriver,
    'OneTouchMini': oneTouchMiniDriver
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
    },
    'OneTouchMini': {
      deviceComms: serialDevice(),
      timeutils: timeutils,
      timezone: $('#timezone').val(),
      jellyfish: jellyfish,
      builder: builder,
      progress_bar: '.OneTouchMini .progress-bar',
      status_text: '.OneTouchMini .status'
    },
  };

  var insuletDriver = require('./lib/insuletDriver.js');
  var blockDevices = {
    'InsuletOmniPod': insuletDriver
  };

  var uploaders = {
    'Carelink': require('./lib/carelink/carelinkDriver.js')(require('./lib/simulator/pwdSimulator.js'), jellyfish)
  };

  function detectFTDIDevice(deviceID, cb) {
    var drivers = {};
    drivers[deviceID] = serialDevices[deviceID];
    var dm = driverManager(drivers, serialConfigs);
    dm.detect(deviceID, cb);
  }

  function doUploads(driverNames, driverObjects, driverConfigs, cb) {
    var dm = driverManager(driverObjects, driverConfigs);
    var devices = [];
    for (var idx = 0; idx < driverNames.length; ++idx) {
      devices.push(dm.process.bind(dm, driverNames[idx]));
    }
    async.series(devices, cb);
  }

  function uploadOneSerial(device) {
    doingUpload = true;
    updateButtons();
    detectFTDIDevice(device, function(err, result) {
      if (err) {
        console.log(device, ' not detected');
      } else {
        $('.' + device + ' .serialNumber').text(result.serialNumber);
        doUploads([device], serialDevices, serialConfigs, function(err, results) {
          console.log(device + ' upload complete!');
          console.log(err);
          console.log(results);
          setTimeout(function() {
            doingUpload = false;
            showRescanButton = true;
            updateButtons();
          }, 1000);
        });
      }
    });
  }

  function uploadSerialOLD2() {
    doingUpload = true;
    showUploadButton = false;
    updateButtons();
    console.log('Uploading for ', activeDeviceIDs);
    doUploads(activeDeviceIDs, serialDevices, serialConfigs, function (err, results) {
      console.log('uploads complete!');
      console.log(err);
      console.log(results);
      setTimeout(function() {
        doingUpload = false;
        showRescanButton = true;
        updateButtons();
      }, 1000);
    });
  }

  function uploadSerialOLD1() {
    var allSerial = _.keys(serialDevices);
    var dm = driverManager(serialDevices, serialConfigs);
    var existingSerial = async.filterSeries(allSerial, function(item, cb) {
      dm.detect(function(err, result) {
        if (err != null) {
          cb(false);
        } else {
          console.log('found ' + result.id);
          cb(true);
        }
      }, function(err, cb) {
        console.log('Uploading for ', existingSerial);
        doUploads(existingSerial, serialDevices, serialConfigs, function (err, results) {
          console.log('uploads complete!');
          console.log(err);
          console.log(results);
        });
      });
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
        //send it to the platform
        api.errors.log(evt, 'InsuletOmniPod reader error!', {});
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
              api.errors.log(err, 'InsuletOmniPod some sort of error occurred (see console).', {});
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
    window.open(config.BLIP_URL);
  });

  // this deals with the omnipod
  $('#omnipodUploadButton').change(handleFileSelect);

  // these are the 3 serial devices
  $('#dexcomUploadButton').click(uploadOneSerial.bind(null, 'DexcomG4'));
  $('#asanteUploadButton').click(uploadOneSerial.bind(null, 'AsanteSNAP'));
  $('#onetouchminiUploadButton').click(uploadOneSerial.bind(null, 'OneTouchMini'));
  // $('#buttonUpload').click(uploadSerial);
  // $('#buttonRescan').click(startScanning);

  function handleCarelinkFileSelect(evt) {
    console.log('Carelink file selected', evt);
    var file = evt.target.files[0];

    // can't ever be more than one in this array since it's not a multiple
    var reader = new FileReader();

    reader.onerror = function (evt) {
      console.log('Reader error!');
      api.errors.log(evt, 'Carelink file reader error!', {});
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
          api.errors.log(err, 'Carelink: some sort of error occurred (see console).', {});
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
        api.errors.log(err, 'Carelink: error when pulling data.', {});
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
  // and make our pretty file buttons click the ugly ones that we've hidden
  $('#omnipodFileButton').click(function () {
    $('#omnipodUploadButton').click();
  });
  $('#carelinkFileButton').click(function () {
    $('#carelinkUploadButton').click();
  });
  connectLog('private build -- Insulet is supported.');

  $('.DexcomG4').hide();
  $('.AsanteSNAP').hide();
  $('.InsuletOmniPod').hide();
  $('.OneTouchMini').hide();
  $('.CareLink').hide();
  updateButtons();
  startScanning();

  $('#saveSettingsButton').click(function () {
    var ckboxes = [
      'DexcomG4',
      'AsanteSNAP',
      'InsuletOmniPod',
      'OneTouchMini',
      'CareLink'
    ];

    var pattern = $('#dexcomPortPattern').val();
    serialConfigs.DexcomG4.deviceComms.setPattern(pattern);
    window.localSave({ dexcomPortPattern: pattern });

    pattern = $('#FTDIPortPattern').val();
    serialConfigs.AsanteSNAP.deviceComms.setPattern(pattern);
    serialConfigs.OneTouchMini.deviceComms.setPattern(pattern);
    window.localSave({ FTDIPortPattern: pattern });

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
      if (settings.FTDIPortPattern) {
        $('#FTDIPortPattern').val(settings.FTDIPortPattern);
        serialConfigs.AsanteSNAP.deviceComms.setPattern(settings.FTDIPortPattern);
        serialConfigs.OneTouchMini.deviceComms.setPattern(settings.FTDIPortPattern);
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
