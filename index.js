// buildUI.js
// this constructs the UI in jQuery

struct = structTools();

timeutils = function() {
    var SEC_TO_MSEC = 1000;
    var MIN_TO_MSEC = 60 * SEC_TO_MSEC;
    var MIN30_TO_MSEC = 30 * MIN_TO_MSEC;

    var buildMsec = function(o, tz_offset_minutes) {
        var t = _.pick(o, ['year', 'month', 'day', 'hours', 'minutes', 'seconds']);
        var d2 = function(x) {
            return ('x00' + x).slice(-2);
        };
        // create s because we can then fool Javascript into ignoring local time zone.
        var s = t.year + '-' + d2(t.month) + '-' + d2(t.day) + 'T' + 
            d2(t.hours) + ':' + d2(t.minutes) + ':' + d2(t.seconds) + 'Z';
        var d;
        if (tz_offset_minutes) {
            // offset for times is the value you see in timestamps (-0800 for PST is -480 minutes)
            // which is what you add to get your local time from zulu time. 
            // to get to zulu time we need to go the other way -- subtract, not add.
            d = Date.parse(s) - tz_offset_minutes * MIN_TO_MSEC;
        } else {
            d = Date.parse(s);
        }
        return d;
    };

    var mSecToISOString = function(ts, tz_offset_minutes) {
        var dt = new Date(ts).toISOString();
        if (tz_offset_minutes != null) {
            return dt;
        } else {
            return dt.slice(0, -5);  // trim off the .000Z from the end
        }        
    };

    // constructs a UTC timestamp from the canonically-named fields in o as well
    // as the time zone offset. If tz_offset_minutes is null (not 0) then the resulting
    // time stamp will NOT include a time zone indicator
    var buildTimestamp = function(o, tz_offset_minutes) {
        var d = buildMsec(o, tz_offset_minutes);
        if (d) {
            return mSecToISOString(d, tz_offset_minutes);
        } else {
            return null;
        }
    };

    return {
        SEC_TO_MSEC: SEC_TO_MSEC,
        MIN_TO_MSEC: MIN_TO_MSEC,
        MIN30_TO_MSEC: MIN30_TO_MSEC,
        buildMsec: buildMsec,
        mSecToISOString: mSecToISOString,
        buildTimestamp: buildTimestamp
    };

}();

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
    isLoggedIn: false,
};

var storageDeviceInfo = {};

var tidepoolServer = {
    get: function(url, happycb, sadcb) {
        var jqxhr = $.ajax({
            type: 'GET',
            url: url,
            headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
        }).success(function(data, status, jqxhr) {
            var tok = jqxhr.getResponseHeader('x-tidepool-session-token');
            if (tok && tok != tidepoolServerData.usertoken) {
                tidepoolServerData.usertoken = tok;
            }
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    post: function(url, data, happycb, sadcb) {
        var jqxhr = $.ajax({
            type: 'POST',
            url: url,
            contentType: 'application/json',
            data: JSON.stringify(data),
            headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
        }).success(function(data, status, jqxhr) {
            var tok = jqxhr.getResponseHeader('x-tidepool-session-token');
            if (tok && tok != tidepoolServerData.usertoken) {
                tidepoolServerData.usertoken = tok;
            }
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    login: function(username, password, happycb, sadcb) {
        var url = tidepoolServerData.host + '/auth/login';
        jqxhr = $.ajax({
            type: 'POST',
            url: url,
            headers: { 'Authorization': make_base_auth(username, password) }, 
        }).success(function(data, status, jqxhr) {
            tidepoolServerData.usertoken = jqxhr.getResponseHeader('x-tidepool-session-token');
            tidepoolServerData.userdata = data;
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    getProfile: function(happycb, sadcb) {
        var url = tidepoolServerData.host + '/metadata/' + tidepoolServerData.userdata.userid + '/profile';
        this.get(url, happycb, sadcb);
    },
    postToJellyfish: function(data, happycb, sadcb) {
        var url = tidepoolServerData.jellyfish + '/data';
        this.post(url, data, happycb, sadcb);
    }
};

var jellyfish = jellyfishClient({tidepoolServer: tidepoolServer});

var serialDevice = {
    connected: false,
    connection: null,
    port: null,
    buffer: [],
    portprefix: '/dev/cu.usb',
    setup: function(portprefix) {
        if (portprefix) {
            serialDevice.portprefix = portprefix;
        }
    },
    connect: function(connectedCB) {
        chrome.serial.getDevices(function(ports) {
            var connected = function(conn) {
                serialDevice.connection = conn;
                serialDevice.connected = true;
                console.log('connected to ' + serialDevice.port.path);
                connectedCB();
            };
            for (var i=0; i<ports.length; i++) {
                console.log(ports[i].path);
                if (ports[i].path.slice(0, serialDevice.portprefix.length) == serialDevice.portprefix) {
                    serialDevice.port = ports[i];
                    chrome.serial.connect(serialDevice.port.path, { bitrate: 9600 }, connected);
                }
            }
        });

        chrome.serial.onReceive.addListener(function(info) {
            if (serialDevice.connected && info.connectionId == serialDevice.connection.connectionId && info.data) {
                var bufView=new Uint8Array(info.data);
                for (var i=0; i<bufView.byteLength; i++) {
                    serialDevice.buffer.push(bufView[i]);
                }
            }
        });
    },
    discardBytes: function(discardCount) {
        serialDevice.buffer = serialDevice.buffer.slice(discardCount);
    },
    readSerial: function(bytes, timeout, callback) {
        var packet;
        if (serialDevice.buffer.length >= bytes) {
            packet = serialDevice.buffer.slice(0,bytes);
            serialDevice.buffer = serialDevice.buffer.slice(0 - bytes);
            callback(packet);
        } else if (timeout === 0) {
            packet = serialDevice.buffer;
            serialDevice.buffer = [];
            callback(packet);
        } else {
            setTimeout(function() {
                serialDevice.readSerial(bytes, 0, callback);
            }, timeout);
        }
    },
    writeSerial: function(bytes, callback) {
        var l = new Uint8Array(bytes).length;
        var sendcheck = function(info) {
            // console.log('Sent %d bytes', info.bytesSent);
            if (l != info.bytesSent) {
                console.log('Only ' + info.bytesSent + ' bytes sent out of ' + l);
            }
            else if (info.error) {
                console.log('Serial send returned ' + info.error);
            }
            callback(info);
        };
        chrome.serial.send(serialDevice.connection.connectionId, bytes, sendcheck);
    }
};

function statusManager(config) {
    var progress = function(msg, pctg) {
        // console.log('Progress: %s -- %d', msg, pctg);
        $('#progressbar').show();
        $('#progressbar').progressbar('option', 'value', pctg);
        $('.progress-label').text(msg);
    };

    var hideProgressBar = function() {
        $('#progressbar').hide();
    };

    var cfg = config;
    if (cfg.progress) {
        progress = cfg.progress;
    }
    var statuses = cfg.steps;

    var setStatus = function(stage, pct) {
        var msg = statuses[stage].name;
        var range = statuses[stage].max - statuses[stage].min;
        var displayPctg = statuses[stage].min + Math.floor(range * pct / 100.0);
        progress(msg, displayPctg);
    };

    return {
        hideProgressBar: hideProgressBar,
        statf: function(stage) {
            return setStatus.bind(this, stage);
        }
    };
}

/* Here's what we want to do:
    call init() on every driver
    do forever:
        call detect() on every driver in a loop or when notified by an insertion
        when a device is detected:
            setup
            connect
            getConfigInfo
            fetchData
            processData
            uploadData
            disconnect
            cleanup
*/

function driverManager(driverObjects, config) {
    var cfg = config;
    var drivers = {};
    var required = [
            'detect',
            'setup',
            'connect',
            'getConfigInfo',
            'fetchData',
            'processData',
            'uploadData',
            'disconnect',
            'cleanup',
        ];

    for (var d in driverObjects) {
        drivers[d] = driverObjects[d](config[d]);
        for (var i=0; i<required.length; ++i) {
            if (typeof(drivers[d][required[i]]) != 'function') {
                console.log('!!!! Driver %s must implement %s', d, required[i]);
            }
        }
    }

    var stat = statusManager({progress: null, steps: [
        { name: 'setting up', min: 0, max: 5 },
        { name: 'connecting', min: 5, max: 10 },
        { name: 'getting configuration data', min: 10, max: 20 },
        { name: 'fetching data', min: 20, max: 50 },
        { name: 'processing data', min: 50, max: 60 },
        { name: 'uploading data', min: 60, max: 90 },
        { name: 'disconnecting', min: 90, max: 95 },
        { name: 'cleaning up', min: 95, max: 100 }
    ]});

    return {
        // iterates the driver list and calls detect; returns the list 
        // of driver keys for the ones that called the callback
        detect: function (cb) {
            var detectfuncs = [];
            for (var d in drivers) {
                detectfuncs.push(drivers[d].detect.bind(drivers[d], d));
            }
            async.series(detectfuncs, function(err, result) {
                if (err) {
                    // something went wrong
                    cb(err, result);
                } else {
                    console.log("done with the series -- result = ", result);
                    var ret = [];
                    for (var r=0; r<result.length; ++r) {
                        if (result[r]) {
                            ret.push(result[r]);
                        }
                    }
                    cb(null, ret);
                }
            });
        },

        process: function (driver, cb) {
            var drvr = drivers[driver];
            console.log(driver);
            console.log(drivers);
            // console.log(drvr);
            async.waterfall([
                    drvr.setup.bind(drvr, stat.statf(0)),
                    drvr.connect.bind(drvr, stat.statf(1)),
                    drvr.getConfigInfo.bind(drvr, stat.statf(2)),
                    drvr.fetchData.bind(drvr, stat.statf(3)),
                    drvr.processData.bind(drvr, stat.statf(4)),
                    drvr.uploadData.bind(drvr, stat.statf(5)),
                    drvr.disconnect.bind(drvr, stat.statf(6)),
                    drvr.cleanup.bind(drvr, stat.statf(7))
                ], function(err, result) {
                    setTimeout(stat.hideProgressBar, 1000);
                    cb(err, result);   
                });
        }
    };
}

function constructUI() {
    //$('body').append('This is a test.');

    var loggedIn = function (isLoggedIn) {
        if (isLoggedIn) {
            $('.showWhenNotLoggedIn').fadeOut(400, function() {
                $('.showWhenLoggedIn').fadeIn();
            });
        } else {
            $('.showWhenLoggedIn').fadeOut(400, function() {
                $('.showWhenNotLoggedIn').fadeIn();
            });
        }
    };

    loggedIn(false);

    var connected = function (isConnected) {
        if (isConnected) {
            $('.showWhenNotConnected').fadeOut(400, function() {
                $('.showWhenConnected').fadeIn();
            });
        } else {
            $('.showWhenConnected').fadeOut(400, function() {
                $('.showWhenNotConnected').fadeIn();
            });
        }
    };

    connected(true);

    // displays text on the connect log
    var connectLog = function(s) {
        if (s[s.length-1] !== '\n') {
            s += '\n';
        }
        var all = $('#connectionLog').val();
        $('#connectionLog').val(all + s);
    };

    $('#loginButton').click(function() {
        var username = $('#username').val();
        var password = $('#password').val();
        var serverIndex = $('#serverURL').val();
        console.log(username, password, serverIndex);
        tidepoolServerData.host = tidepoolHosts[serverIndex].host;
        tidepoolServerData.jellyfish = tidepoolHosts[serverIndex].jellyfish;

        var goodLogin = function(data, status, jqxhr) {
            console.log(data);
            connectLog(status);
            getProfile();
            loggedIn(true);
        };

        var failLogin = function(jqxhr, status, error) {
            connectLog('Login FAILED!', status, error);
            loggedIn(false);
        };

        var goodProfile = function(data, status, jqxhr) {
            connectLog(status);
            connectLog(data.toString());
            $('.loginname').text(data.fullName);
        };

        var failProfile = function(jqxhr, status, error) {
            connectLog('FAILED!', status, error);
        };

        var getProfile = function() {
            connectLog('Fetching profile.');
            tidepoolServer.getProfile(goodProfile, failProfile);
        };

        tidepoolServer.login(username, password, goodLogin, failLogin);
    });

    $('#logoutButton').click(function() {
        loggedIn(false);
    });

    var foundDevice = function(devConfig, deviceArray) {
        for (var d=0; d<deviceArray.length; ++d) {
            var dev = deviceArray[d];
            connectLog("Discovered " + devConfig.deviceName);
            console.log(devConfig);
            searchOnce();
        }
    };

    var scanUSBDevices = function() {
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

    chrome.system.storage.onAttached.addListener(function (info){
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

    chrome.system.storage.onDetached.addListener(function (id){
        connectLog('detached: ' + storageDeviceInfo[id].name);
        delete(storageDeviceInfo[id]);
    });

    var openFile = function() {
        console.log('OpenFile');
        chrome.fileSystem.chooseEntry({type: 'openFile'}, function(readOnlyEntry) {
            console.log(readOnlyEntry);
            readOnlyEntry.file(function(file) {
                console.log(file);
                var reader = new FileReader();

                reader.onerror = function() {
                    connectLog('Error reading file!');
                };
                reader.onloadend = function(e) {
                    // e.target.result contains the contents of the file
                    // console.log(e.target.result);
                    console.log(e.target.result);
                };

                reader.readAsText(file);
            });
        });
    };

    var deviceComms = serialDevice;
    var asanteDevice = asanteDriver({deviceComms: deviceComms});

    deviceComms.connect(function() {connectLog('connected');});
    var testSerial = function() {
        var buf = new ArrayBuffer(1);
        var bytes = new Uint8Array(buf);
        bytes[0] = 97;
        deviceComms.writeSerial(buf, function() {connectLog('"a" sent');});
    };

    var getSerial = function(timeout) {
        deviceComms.readSerial(200, timeout, function(packet) {
            connectLog('received ' + packet.length + ' bytes');
            var s = '';
            for (var c in packet) {
                s += String.fromCharCode(packet[c]);
            }
            connectLog(s);
        });
    };

    var watchSerial = function() {
        setTimeout(function () {
            getSerial(0);
            setTimeout(watchSerial, 1000);
        }, 1000);
    };

    var deviceInfo = null;
    var prevTimestamp = null;
    var test1 = function() {
        var get = function(url, happycb, sadcb) {
            $.ajax({
                type: 'GET',
                url: url
            }).success(function(data, status, jqxhr) {
                // happycb(data, status, jqxhr);
                console.log('success!');
                console.log(data);
            }).error(function(jqxhr, status, err) {
                // sadcb(jqxhr, status, err);
                console.log('FAIL');
            });
        };

        var url = 'http://localhost:8888/foo.txt';
        get(url);
    };

    var serialDevices = {
            'AsanteSNAP': asanteDriver,
            // 'Dexcom G4 CGM': dexcomDriver,
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
        'Dexcom G4 CGM': {
            deviceComms: deviceComms,
            timeutils: timeutils,
            tz_offset_minutes: parseInt($('#timezone').val()),
            jellyfish: jellyfish
        }
    };

    var blockDevices = {
            // 'InsuletOmniPod': insuletDriver
        };


    var search = function(driverObjects, driverConfigs, cb) {
        var dm = driverManager(driverObjects, driverConfigs);
        dm.detect(function (err, found) {
            if (err) {
                console.log("search returned error:", err);
                cb(err, found);
            } else {
                var devices = [];
                // we might have found several devices, so make a binding
                // for the process functor for each, then run them in series.
                for (var f=0; f < found.length; ++f) {
                    devices.push(dm.process.bind(dm, found[f]));
                }
                async.series(devices, cb);
            }
        });

    };

    var searchOnce = function() {
        search(serialDevices, serialConfigs, function(err, results) {
            if (err) {
                console.log('Fail');
                console.log(err);
            } else {
                console.log('Success');
                console.log(results);
            }
        });
    };

    var searching = null;
    var processing = false;
    var searchRepeatedly = function() {
        searching = setInterval(function () {
            if (processing) {
                console.log('skipping');
                return;
            }
            processing = true;
            search(serialDevices, serialConfigs, function(err, results) {
                processing = false;
            });
        }, 5000);
    };

    var cancelSearch = function() {
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

            reader.onerror = function(evt) {
                console.log('Reader error!');
                console.log(evt);
            };

            // closure to bind the filename
            reader.onloadend = (function (theFile) {
                return function(e) {
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
                    search(blockDevices, cfg, function(err, results) {
                        if (err) {
                            console.log('Fail');
                            console.log(err);
                            console.log(results);
                        } else {
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

    $('#testButton2').click(searchRepeatedly);
    // $('#testButton3').click(cancelSearch);
    // $('#testButton').click(findAsante);
    $('#testButton1').click(scanUSBDevices);
    $('#testButton3').click(searchOnce);
  // $('#testButton3').click(util.test);

    // jquery stuff
    $('#progressbar').progressbar({
      value: false
    });
    $('#progressbar').hide();
}

$(constructUI);

// Uploader needs a timezone selector


