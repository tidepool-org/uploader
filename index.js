// buildUI.js
// this constructs the UI in jQuery

var make_base_auth = function (username, password) {
  var tok = username + ':' + password;
  var hash = btoa(tok);
  return "Basic " + hash;
}

var tidepoolServerData = {
    host: '',
    usertoken: '',
    userdata: null,
    isLoggedIn: false,
};

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
}


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
    }

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
    }

    connected(true);

    // displays text on the connect log
    var connectLog = function(s) {
        if (s[s.length-1] !== '\n') {
            s += '\n'
        }
        var all = $("#connectionLog").val();
        $("#connectionLog").val(all + s);
    }

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
        }

        var failLogin = function(jqxhr, status, error) {
            connectLog("Login FAILED!", status, error);
            loggedIn(false);
        }

        var goodProfile = function(data, status, jqxhr) {
            connectLog(status);
            connectLog(data.toString());
            $(".loginname").text(data.fullName);
        }

        var failProfile = function(jqxhr, status, error) {
            connectLog("FAILED!", status, error);
        }

        var getProfile = function() {
            connectLog("Fetching profile.");
            tidepoolServer.getProfile(goodProfile, failProfile);
        };

        tidepoolServer.login(username, password, goodLogin, failLogin);
    });

    $("#logoutButton").click(function() {
        loggedIn(false);
    });

    $("#testButton").click(getProfile);
}

$(constructUI)
