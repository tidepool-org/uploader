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

    $("#testButton").click(getUSBDevices);

}

$(constructUI);

