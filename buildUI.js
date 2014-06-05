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

    $("#loginButton").click(function() {
        loggedIn(true);
    });
    $("#logoutButton").click(function() {
        loggedIn(false);
    });
}

$(constructUI)
