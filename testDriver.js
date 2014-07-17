testDriver = function(config) {
    var cfg = config;

    return {
        // should call the callback with null, obj if the item 
        // was detected, with null, null if not detected.
        // call err only if there's something unrecoverable.
        detect: function (obj, cb) {
            setTimeout(function() {
                // for our demo, sometimes we don't detect a driver
                if (Math.random() > 0.2) {
                    cb(null, obj);
                } else {
                    cb(null, null);
                }
                // and we may take a while to respond
            }, Math.random() * 10000);
        },

        setup: function (progress, cb) {
            progress(100);
            cb(null, "setup");
        },

        connect: function (progress, cb) {
            progress(100);
            cb(null, "connect");
        },

        getConfigInfo: function (progress, cb) {
            progress(100);
            cb(null, "getConfigInfo");
        },

        fetchData: function (progress, cb) {
            progress(100);
            cb(null, "fetchData");
        },

        processData: function (progress, cb) {
            progress(40);
            setTimeout(function() {
                progress(100);
                cb(null, "processData");
            }, Math.random() * 10000);
        },

        uploadData: function (progress, cb) {
            progress(100);
            cb(null, "uploadData");
        },

        disconnect: function (progress, cb) {
            progress(100);
            cb(null, "disconnect");
        },

        cleanup: function (progress, cb) {
            progress(100);
            cb(null, "cleanup");
        }
    };
};