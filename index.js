// buildUI.js
// this constructs the UI in jQuery

var make_base_auth = function (username, password) {
  var tok = username + ':' + password;
  var hash = btoa(tok);
  return "Basic " + hash;
};

var tidepoolHosts = {
    local: { host: "http://localhost:8009", jellyfish: "http://localhost:9122" },
    devel: { host: "https://devel-api.tidepool.io", jellyfish: "https://devel-uploads.tidepool.io" },
    staging: { host: "https://staging-api.tidepool.io", jellyfish: "https://staging-uploads.tidepool.io" },
    prod: { host: "https://api.tidepool.io", jellyfish: "https://uploads.tidepool.io" }
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
        var url = tidepoolServerData.host + "/auth/login";
        jqxhr = $.ajax({
            type: 'POST',
            url: url,
            headers: { "Authorization": make_base_auth(username, password) }, 
        }).success(function(data, status, jqxhr) {
            tidepoolServerData.usertoken = jqxhr.getResponseHeader('x-tidepool-session-token');
            tidepoolServerData.userdata = data;
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    getProfile: function(happycb, sadcb) {
        var url = tidepoolServerData.host + "/metadata/" + tidepoolServerData.userdata.userid + "/profile";
        this.get(url, happycb, sadcb);
    },
    postToJellyfish: function(data, happycb, sadcb) {
        var url = tidepoolServerData.jellyfish + "/data";
        this.post(url, data, happycb, sadcb);
    }
};

var serialDevice = {
    connected: false,
    connection: null,
    port: null,
    buffer: [],
    portprefix: "/dev/cu.usb",
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
                console.log("connected to " + serialDevice.port.path);
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
    // When you call this, it looks to see if a complete Dexcom packet has
    // arrived and it calls the callback with it and strips it from the buffer. 
    // It returns true if a packet was found, and false if not.
    readDexcomPacket: function(callback) {
        // for efficiency reasons, we're not going to bother to ask the driver
        // to decode things that can't possibly be a packet
        // first, discard bytes that can't start a packet
        var discardCount = 0;
        while (serialDevice.buffer.length > 0 && serialDevice.buffer[0] != dexcomDriver.SYNC_BYTE) {
            ++discardCount;
        }
        if (discardCount) {
            serialDevice.discardBytes(discardCount);
        }

        if (serialDevice.buffer.length < 6) { // all complete packets must be at least this long
            return false;       // not enough there yet
        }

        // there's enough there to try, anyway
        var packet = dexcomDriver.extractPacket(serialDevice.buffer);
        if (packet.packet_len !== 0) {
            // remove the now-processed packet
            serialDevice.discardBytes(packet.packet_len);
        }
        callback(packet);
        return true;
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
            console.log("Sent %d bytes", info.bytesSent);
            if (l != info.bytesSent) {
                console.log("Only " + info.bytesSent + " bytes sent out of " + l);
            }
            else if (info.error) {
                console.log("Serial send returned " + info.error);
            }
            callback(info);
        };
        chrome.serial.send(serialDevice.connection.connectionId, bytes, sendcheck);
    }
};



function constructUI() {
    //$('body').append('This is a test.');

    var loggedIn = function (isLoggedIn) {
        if (isLoggedIn) {
            $(".showWhenNotLoggedIn").fadeOut(400, function() {
                $(".showWhenLoggedIn").fadeIn();
            });
        } else {
            $(".showWhenLoggedIn").fadeOut(400, function() {
                $(".showWhenNotLoggedIn").fadeIn();
            });
        }
    };

    loggedIn(false);

    var connected = function (isConnected) {
        if (isConnected) {
            $(".showWhenNotConnected").fadeOut(400, function() {
                $(".showWhenConnected").fadeIn();
            });
        } else {
            $(".showWhenConnected").fadeOut(400, function() {
                $(".showWhenNotConnected").fadeIn();
            });
        }
    };

    connected(true);

    // displays text on the connect log
    var connectLog = function(s) {
        if (s[s.length-1] !== '\n') {
            s += '\n';
        }
        var all = $("#connectionLog").val();
        $("#connectionLog").val(all + s);
    };

    $("#loginButton").click(function() {
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
            connectLog("Login FAILED!", status, error);
            loggedIn(false);
        };

        var goodProfile = function(data, status, jqxhr) {
            connectLog(status);
            connectLog(data.toString());
            $(".loginname").text(data.fullName);
        };

        var failProfile = function(jqxhr, status, error) {
            connectLog("FAILED!", status, error);
        };

        var getProfile = function() {
            connectLog("Fetching profile.");
            tidepoolServer.getProfile(goodProfile, failProfile);
        };

        tidepoolServer.login(username, password, goodLogin, failLogin);
    });

    $("#logoutButton").click(function() {
        loggedIn(false);
    });

    var processOneDevice = function(devname, deviceArray) {
        for (var d=0; d<deviceArray.length; ++d) {
            dev = deviceArray[d];
            connectLog(devname);
            connectLog(dev.device);
            connectLog(dev.vendorId);
            connectLog(dev.productId);
        }
    };

    var getUSBDevices = function() {
        manifest = chrome.runtime.getManifest();
        for (var p = 0; p < manifest.permissions.length; ++p) {
            var perm = manifest.permissions[p];
            if (perm.usbDevices) {
                for (d = 0; d < perm.usbDevices.length; ++d) {
                    console.log(perm.usbDevices[d]);
                    var f = processOneDevice.bind(this, perm.usbDevices[d].deviceName);
                    chrome.usb.getDevices({
                        vendorId: perm.usbDevices[d].vendorId,
                        productId: perm.usbDevices[d].productId
                    }, f);
                }
            }
        }
    };

    chrome.system.storage.onAttached.addListener(function (info){
        connectLog("attached: " + info.name);
        storageDeviceInfo[info.id] = {
            id: info.id,
            name: info.name,
            type: info.type
        };
        console.log(storageDeviceInfo[info.id]);
    });

    chrome.system.storage.onDetached.addListener(function (id){
        connectLog("detached: " + storageDeviceInfo[id].name);
        delete(storageDeviceInfo[id]);
    });

    var openFile = function() {
        console.log("OpenFile");
        chrome.fileSystem.chooseEntry({type: 'openFile'}, function(readOnlyEntry) {
            console.log(readOnlyEntry);
            readOnlyEntry.file(function(file) {
                console.log(file);
                var reader = new FileReader();

                reader.onerror = function() {
                    connectLog("Error reading file!");
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

    // $("#testButton").click(findAsante);
    // $("#testButton1").click(getUSBDevices);
    var deviceComms = serialDevice;
    var asanteDevice = asanteDriver({deviceComms: deviceComms});

    deviceComms.connect(function() {connectLog("connected");});
    var testSerial = function() {
        var buf = new ArrayBuffer(1);
        var bytes = new Uint8Array(buf);
        bytes[0] = 97;
        deviceComms.writeSerial(buf, function() {connectLog("'a' sent");});
    };

    var getSerial = function(timeout) {
        deviceComms.readSerial(200, timeout, function(packet) {
            connectLog("received " + packet.length + " bytes");
            var s = "";
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

    // callback gets a result packet with parsed payload
    var dexcomCommandResponse = function(commandpacket, callback) {
        var processResult = function(result) {
            console.log(result);
            if (result.command != dexcomDriver.CMDS.ACK) {
                console.log("Bad result %d (%s) from data packet", 
                    result.command, dexcomDriver.getCmdName(result.command));
                console.log("Command packet was:");
                bytes = new Uint8Array(commandpacket.packet);
                console.log(bytes);
                console.log("Result was:");
                console.log(result);
            } else {
                // only attempt to parse the payload if it worked
                if (result.payload) {
                    result.parsed_payload = commandpacket.parser(result);
                }
            }
            callback(result);
        };

        var waitloop = function() {
            if (!deviceComms.readDexcomPacket(processResult)) {
                console.log('.');
                setTimeout(waitloop, 100);
            }
        };

        deviceComms.writeSerial(commandpacket.packet, function() {
            console.log("->");
            waitloop();
        });
    };

    var deviceInfo = null;
    var counter=0;
    var prevTimestamp = null;
    var postJellyfish = function (egvpage, callback) {
        console.log("poster");
        console.log(deviceInfo);
        var datapt = {
          "type": "cbg",
          "units": "mg/dL",
          "value": 0,
          "time": "",
          "deviceTime": "",
          "deviceId": deviceInfo.ProductName + "/12345",
          "source": "device"
        };

        var localtime = function(t) {
            var s = t.toISOString();
            return s.substring(0, s.length - 1);
        };
        var data = [];
        var recCount = 0;
        for (var i = egvpage.header.nrecs - 1; i>=0; --i) {
            datapt.value = egvpage.data[i].glucose;
            datapt.time = egvpage.data[i].displayTime.toISOString();
            datapt.deviceTime = localtime(egvpage.data[i].displayTime);
            if (datapt.value < 15) {    // it's a "special" (error) value
                console.log("Skipping datapoint with special bg.");
                console.log(datapt);
                continue;
            }
	    if (prevTimestamp == null || datapt.time !== prevTimestamp) {
              data.push($.extend({}, datapt));
              prevTimestamp = datapt.time;
            }
            recCount++;
        }
        console.log(data);
        var happy = function(resp, status, jqxhr) {
            console.log("Jellyfish post succeeded.");
            console.log(status);
            console.log(resp);
            callback(null, recCount);
        };
        var sad = function(jqxhr, status, err) {
            if (jqxhr.responseJSON.errorCode && jqxhr.responseJSON.errorCode == "duplicate") {
                callback("STOP", jqxhr.responseJSON.index);
            } else {
                console.log("Jellyfish post failed.");
                console.log(status);
                console.log(err);
                callback(err, 0);
            }
        };
        tidepoolServer.postToJellyfish(data, happy, sad);
    };

    var fetchOneEGVPage = function(pagenum, callback) {
        var cmd = dexcomDriver.readDataPages(
            dexcomDriver.RECORD_TYPES.EGV_DATA, pagenum, 1);
        dexcomCommandResponse(cmd, function(page) {
            console.log("page");
            console.log(page.parsed_payload);
            postJellyfish(page.parsed_payload, callback);
        });
    };

    var connectDexcom = function() {
        var cmd = dexcomDriver.readFirmwareHeader();
        dexcomCommandResponse(cmd, function(result) {
            console.log("firmware header");
            deviceInfo = result.parsed_payload.attrs;
            console.log(result);
            var cmd2 = dexcomDriver.readDataPageRange(dexcomDriver.RECORD_TYPES.EGV_DATA);
            dexcomCommandResponse(cmd2, function(pagerange) {
                console.log("page range");
                var range = pagerange.parsed_payload;
                console.log(range);
                var pages = [];
                var lastpage = $("#lastpage").val();
                for (var pg = range.hi-lastpage; pg >= range.lo; --pg) {
                    pages.push(pg);
                }
                async.mapSeries(pages, fetchOneEGVPage, function(err, results) {
                    console.log(results);
                    var sum = 0;
                    for (var i=0; i<results.length; ++i) {
                        sum += results[i];
                    }
                    var msg = sum + " new records uploaded.";
                    if (err == 'STOP') {
                        console.log(msg);
                    } else if (err) {
                        console.log("Error: ", err);
                    } else {
                        console.log(msg);
                    }
                });

            });
        });
    };

    var testPack = function() {
        buf = new Uint8Array(30);
        len = util.pack(buf, 0, "IIbsIb", 254, 65534, 55, 1023, 256, 7);
        console.log(buf);
        result = util.unpack(buf, 0, "IIbsIb", ['a', 'b', 'c', 'd', 'e', 'f']);
        console.log(result);
        buf[0] = 0xff;
        buf[1] = 0xff;
        buf[2] = 0xff;
        buf[3] = 0xff;
        result = util.unpack(buf, 0, "I", ['x']);
        console.log(result);
    };

    // $("#testButton").click(testSerial);

    var testJellyfish = function() {
        var datapt = {
          "type": "cbg",
          "units": "mg/dL",
          "value": 0,
          "time": "",
          "deviceTime": "",
          "deviceId": "KentTest123",
          "source": "device"
        };

        var data = [];
        var starttime = new Date(2014, 1, 23, 6);
        var increment = 10 * 60 * 1000;  // 10 minutes
        var duration = 30 * 60 * 60 * 1000; // 30 hours
        var EDT_offset = -4 * 60 * 60 * 1000; // 4 hours
        var startbg = 150;
        for (var dt = 0; dt < duration; dt += increment) {
            datapt.value = (startbg + 105 * Math.sin(dt/(10 * increment)));
            var t = starttime.valueOf() + dt;
            datapt.time = new Date(t).toISOString();
            var devtime = new Date(t + EDT_offset).toISOString();
            datapt.deviceTime = devtime.substring(0, devtime.length-1);
            data.push($.extend({}, datapt));
        }
        console.log(data);
        postJellyfish(data);
    };

    var test1 = function() {
        var get = function(url, happycb, sadcb) {
            var jqxhr = $.ajax({
                type: 'GET',
                url: url
            }).success(function(data, status, jqxhr) {
                // happycb(data, status, jqxhr);
                console.log("success!");
                console.log(data);
            }).error(function(jqxhr, status, err) {
                // sadcb(jqxhr, status, err);
                console.log("FAIL");
            });
        };

        var url = "http://localhost:8888/foo.txt";
        get(url);
    };

    $("#testButton1").click(asanteDevice.findAsante);
    $("#testButton2").click(test1);
    $("#testButton3").click(asanteDevice.listenForBeacon);

}

$(constructUI);

