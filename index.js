// buildUI.js
// this constructs the UI in jQuery

var make_base_auth = function (username, password) {
  var tok = username + ':' + password;
  var hash = btoa(tok);
  return "Basic " + hash;
};

var tidepoolServerData = {
    host: '',
    usertoken: '',
    userdata: null,
    isLoggedIn: false,
};

var storageDeviceInfo = {};

var tidepoolServer = {
    get: function(url, query, happycb, sadcb) {
        jqxhr = $.ajax({
            type: 'GET',
            url: url,
            headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
        }).success(function(data, status, jqxhr) {
            tidepoolServerData.usertoken = jqxhr.getResponseHeader('x-tidepool-session-token');
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    post: function(path, data, happycb, sadcb) {
        jqxhr = $.post(url, query, happycb).fail(sadcb);
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
        this.get(url, null, happycb, sadcb);
    }
};

var serialDevice = {
    connected: false,
    connection: null,
    port: null,
    buffer: [],
    portprefix: "/dev/cu.usbmodem",
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
    // When you call this, it looks to see if a complete Asante packet has
    // arrived and it calls the callback with it and strips it from the buffer. 
    // It returns true if a packet was found, and false if not.
    readAsantePacket: function(callback) {
        // for efficiency reasons, we're not going to bother to ask the driver
        // to decode things that can't possibly be a packet
        // first, discard bytes that can't start a packet
        var discardCount = 0;
        while (serialDevice.buffer.length > 0 && serialDevice.buffer[0] != asanteDriver.SYNC_BYTE) {
            ++discardCount;
        }
        if (discardCount) {
            serialDevice.buffer = serialDevice.buffer.slice(discardCount);
        }

        if (serialDevice.buffer.length <= 6) { // all complete packets must be this long
            return false;       // not enough there yet
        }

        // there's enough there to try, anyway
        var packet = asanteDriver.unpackPacket(serialDevice.buffer);
        if (packet.packet_len !== 0) {
            // remove the now-processed packet
            packet.serialDevice.buffer.slice(packet.packet_len);
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

    // var serverURL = 'http://localhost:8009';
    // $('#serverURL').change(function() {

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
        var server = $('#serverURL').val();
        console.log(username, password, server);
        tidepoolServerData.host = server;

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

    var receiveAsante = function(info) {
        console.log(info);
        if (info.resultCode == 0) {
            console.log("Success");
            // info.data is an ArrayBuffer
            packet = new Uint8Array(info.data);
            console.log(packet);
        }
    };

    var handleAsante = function(handleArray) {
        // handleArray should have just one entry
        console.log(handleArray);
        var h = handleArray[0];
        // the bulk input number is 0x81, the output is 0x82
        var trinput = {
            direction: "in",
            endpoint: 0x81,
            length: 200,
            data: null
        };

        chrome.usb.bulkTransfer(h, trinput, receiveAsante);
    };

    var findAsante = function() {
        manifest = chrome.runtime.getManifest();
        for (var p = 0; p < manifest.permissions.length; ++p) {
            var perm = manifest.permissions[p];
            if (perm.usbDevices) {
                for (d = 0; d < perm.usbDevices.length; ++d) {
                    if (perm.usbDevices[d].deviceName == 'Asante SNAP') {
                        chrome.usb.findDevices({
                            vendorId: perm.usbDevices[d].vendorId,
                            productId: perm.usbDevices[d].productId
                        }, handleAsante);
                    }
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
                var reader = new FileReader();

                reader.onerror = function() {
                    connectLog("Error reading file!");
                };
                reader.onloadend = function(e) {
                    // e.target.result contains the contents of the file
                    // console.log(e.target.result);
                };

                reader.readAsText(file);
            });
        });
    };

    // $("#testButton").click(findAsante);
    $("#testButton").click(getUSBDevices);
    var sp = serialDevice;
    sp.connect(function() {connectLog("connected");});
    var testSerial = function() {
        buf = new ArrayBuffer(1);
        bytes = new Uint8Array(buf);
        bytes[0] = 97;
        sp.writeSerial(buf, function() {connectLog("'a' sent");});
    };

    var getSerial = function(timeout) {
        sp.readSerial(200, timeout, function(packet) {
            connectLog("received " + packet.length + " bytes");
            s = "";
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

    // watchSerial();

    // $("#testButton").click(testSerial);

}

$(constructUI);

