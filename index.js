// buildUI.js
// this constructs the UI in jQuery

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
        $(".loginname").text(username);
        loggedIn(true);
    });

    $("#logoutButton").click(function() {
        loggedIn(false);
    });

    $("#testButton").click(function() {
        connectLog("Button clicked.");
    });

}

$(constructUI)
