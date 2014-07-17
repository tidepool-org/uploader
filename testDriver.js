testDriver = function(config) {
    var cfg = config;

    return {
        detect: function () {
            return true;
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
            progress(100);
            cb(null, "processData");
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