// buildUI.js
// this constructs the UI in jQuery

var $ = require('jquery');
window.jQuery = $;
var async = require('async');
var timeutils = require('./lib/timeutils.js');
var util = require('util');

require('./jquery-ui-1.11.0.custom/jquery-ui.css');
require('./styles/main.css');
require('./jquery-ui-1.11.0.custom/jquery-ui.js');

var make_base_auth = function (username, password) {
  var tok = username + ':' + password;
  var hash = btoa(tok);
  return 'Basic ' + hash;
};

var tidepoolHosts = {
  local: { host: 'http://localhost:8009', jellyfish: 'http://localhost:9122' },
  devel: { host: 'https://devel-api.tidepool.io', jellyfish: 'https://devel-uploads.tidepool.io' },
  staging: { host: 'https://staging-api.tidepool.io', jellyfish: 'https://staging-uploads.tidepool.io' },
  prod: { host: 'https://api.tidepool.io', jellyfish: 'https://uploads.tidepool.io' }
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
    var jqxhr = $.ajax({
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
    var jqxhr = $.ajax({
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
    jqxhr = $.ajax({
                     type: 'POST',
                     url: url,
                     headers: { 'Authorization': make_base_auth(username, password) },
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
  postToJellyfish: function (data, happycb, sadcb) {
    var url = tidepoolServerData.jellyfish + '/data';
    this.post(url, data, happycb, sadcb);
  }
};

var jellyfish = require('./lib/jellyfishClient.js')({tidepoolServer: tidepoolServer});
var serialDevice = require('./lib/serialDevice.js');
var driverManager = require('./lib/driverManager.js');

function constructUI() {
  //$('body').append('This is a test.');

  var loggedIn = function (isLoggedIn) {
    if (isLoggedIn) {
      $('.showWhenNotLoggedIn').fadeOut(400, function () {
        $('.showWhenLoggedIn').fadeIn();
      });
    } else {
      $('.showWhenLoggedIn').fadeOut(400, function () {
        $('.showWhenNotLoggedIn').fadeIn();
      });
    }
  };

  loggedIn(false);

  var connected = function (isConnected) {
    if (isConnected) {
      $('.showWhenNotConnected').fadeOut(400, function () {
        $('.showWhenConnected').fadeIn();
      });
    } else {
      $('.showWhenConnected').fadeOut(400, function () {
        $('.showWhenNotConnected').fadeIn();
      });
    }
  };

  connected(true);

  // displays text on the connect log
  var connectLog = function (s) {
    if (s[s.length - 1] !== '\n') {
      s += '\n';
    }
    var all = $('#connectionLog').val();
    $('#connectionLog').val(all + s);
  };

  $('#loginButton').click(function () {
    var username = $('#username').val();
    var password = $('#password').val();
    var serverIndex = $('#serverURL').val();
    console.log(username, password, serverIndex);
    tidepoolServerData.host = tidepoolHosts[serverIndex].host;
    tidepoolServerData.jellyfish = tidepoolHosts[serverIndex].jellyfish;

    var goodLogin = function (data, status, jqxhr) {
      console.log(data);
      connectLog(status);
      getProfile();
      loggedIn(true);
    };

    var failLogin = function (jqxhr, status, error) {
      console.log('Login failed.');
      connectLog('Login failed.'); //, status, error); don't display status -- it includes password!
      $('.loginstatus').text('Login failed');
      loggedIn(false);
    };

    var goodProfile = function (data, status, jqxhr) {
      connectLog(status);
      connectLog(util.format('%j', data));
      $('.loginname').text(data.fullName);
    };

    var failProfile = function (jqxhr, status, error) {
      connectLog('FAILED!', status, error);
    };

    var getProfile = function () {
      connectLog('Fetching profile.');
      tidepoolServer.getProfile(goodProfile, failProfile);
    };

    tidepoolServer.login(username, password, goodLogin, failLogin);
  });

  $('#logoutButton').click(function () {
    loggedIn(false);
  });

  var foundDevice = function (devConfig, devicesFound) {
    // theoretically we could have multiple devices of the same type plugged in,
    // but we kind of ignore that now. This will fail if you do that.
    for (var d = 0; d < devicesFound.length; ++d) {
      var dev = devicesFound[d];
      connectLog('Discovered ' + devConfig.deviceName);
      console.log(devConfig);
      searchOnce([devConfig.driverId]);
    }
  };

  var scanUSBDevices = function () {
    var manifest = chrome.runtime.getManifest();
    for (var p = 0; p < manifest.permissions.length; ++p) {
      var perm = manifest.permissions[p];
      if (perm.usbDevices) {
        for (var d = 0; d < perm.usbDevices.length; ++d) {
          // console.log(perm.usbDevices[d]);
          var f = foundDevice.bind(this, perm.usbDevices[d]);
          chrome.usb.getDevices({
                                  vendorId: perm.usbDevices[d].vendorId,
                                  productId: perm.usbDevices[d].productId
                                }, f);
        }
      }
    }
  };

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

  var openFile = function () {
    console.log('OpenFile');
    chrome.fileSystem.chooseEntry({type: 'openFile'}, function (readOnlyEntry) {
      console.log(readOnlyEntry);
      readOnlyEntry.file(function (file) {
        console.log(file);
        var reader = new FileReader();

        reader.onerror = function () {
          connectLog('Error reading file!');
        };
        reader.onloadend = function (e) {
          // e.target.result contains the contents of the file
          // console.log(e.target.result);
          console.log(e.target.result);
        };

        reader.readAsText(file);
      });
    });
  };

  var asanteDriver = require('./lib/asanteDriver.js');
  var dexcomDriver = require('./lib/dexcomDriver.js');

  var deviceComms = serialDevice({});
  var asanteDevice = asanteDriver({deviceComms: deviceComms});

  deviceComms.connect(function () {connectLog('connected');});
  var testSerial = function () {
    var buf = new ArrayBuffer(1);
    var bytes = new Uint8Array(buf);
    bytes[0] = 97;
    deviceComms.writeSerial(buf, function () {connectLog('"a" sent');});
  };

  var getSerial = function (timeout) {
    deviceComms.readSerial(200, timeout, function (packet) {
      connectLog('received ' + packet.length + ' bytes');
      var s = '';
      for (var c in packet) {
        s += String.fromCharCode(packet[c]);
      }
      connectLog(s);
    });
  };

  var watchSerial = function () {
    setTimeout(function () {
      getSerial(0);
      setTimeout(watchSerial, 1000);
    }, 1000);
  };

  var deviceInfo = null;
  var prevTimestamp = null;
  var test1 = function () {
    var get = function (url, happycb, sadcb) {
      $.ajax({
               type: 'GET',
               url: url
             }).success(function (data, status, jqxhr) {
        // happycb(data, status, jqxhr);
        console.log('success!');
        console.log(data);
      }).error(function (jqxhr, status, err) {
        // sadcb(jqxhr, status, err);
        console.log('FAIL');
      });
    };

    var url = 'http://localhost:8888/foo.txt';
    get(url);
  };

  var serialDevices = {
    'AsanteSNAP': asanteDriver,
    'DexcomG4': dexcomDriver,
    // 'Test': testDriver,
    // 'AnotherTest': testDriver
  };

  var serialConfigs = {
    'AsanteSNAP': {
      deviceComms: deviceComms,
      timeutils: timeutils,
      tz_offset_minutes: parseInt($('#timezone').val()),
      jellyfish: jellyfish
    },
    'DexcomG4': {
      deviceComms: deviceComms,
      timeutils: timeutils,
      tz_offset_minutes: parseInt($('#timezone').val()),
      jellyfish: jellyfish
    }
  };

  // var insuletDriver = require('./lib/insuletDriver.js');
  var blockDevices = {
    // 'InsuletOmniPod': insuletDriver
  };


  var search = function (driverObjects, driverConfigs, enabledDevices, cb) {
    var dm = driverManager(driverObjects, driverConfigs, enabledDevices);
    dm.detect(function (err, found) {
      if (err) {
        console.log("search returned error:", err);
        cb(err, found);
      } else {
        var devices = [];
        console.log("Devices found: ", devices);
        // we might have found several devices, so make a binding
        // for the process functor for each, then run them in series.
        for (var f = 0; f < found.length; ++f) {
          connectLog('Found ' + found[f]);
          devices.push(dm.process.bind(dm, found[f]));
        }
        async.series(devices, cb);
      }
    });

  };

  var searchOnce = function (enabledDevices) {
    search(serialDevices, serialConfigs, enabledDevices, function (err, results) {
      if (err) {
        connectLog('Some sort of error occurred (see console).');
        console.log('Fail');
        console.log(err);
      } else {
        connectLog('The upload succeeded.');
        console.log('Success');
        console.log(results);
      }
    });
  };

  var searching = null;
  var processing = false;
  var searchRepeatedly = function () {
    searching = setInterval(function () {
      if (processing) {
        console.log('skipping');
        return;
      }
      processing = true;
      search(serialDevices, serialConfigs, function (err, results) {
        processing = false;
      });
    }, 5000);
  };

  var cancelSearch = function () {
    if (searching) {
      clearInterval(searching);
      searching = null;
    }
  };

  var handleFileSelect = function (evt) {
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
              tz_offset_minutes: parseInt($('#timezone').val()),
              jellyfish: jellyfish
            }
          };
          search(blockDevices, cfg, function (err, results) {
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
  };

  $('#filechooser').change(handleFileSelect);

  // $('#testButton2').click(searchRepeatedly);
  // $('#testButton3').click(cancelSearch);
  $('#testButton1').click(scanUSBDevices);
  // $('#testButton2').click(scanUSBDevices);
  // $('#testButton3').click(util.test);

  // jquery stuff
  $('#progressbar').progressbar({
                                  value: false
                                });
  $('#progressbar').hide();
  // connectLog("private build -- Insulet is supported.");
}

$(constructUI);

// Uploader needs a timezone selector


