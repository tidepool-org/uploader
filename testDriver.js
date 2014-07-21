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

        // this function starts the chain, so it has to create but not accept
        // the result (data) object; it's then passed down the rest of the chain
        setup: function (progress, cb) {
            progress(100);
            cb(null, { setup: true });
        },

        connect: function (progress, data, cb) {
            progress(100);
            data.connect = true;
            cb(null, data);
        },

        getConfigInfo: function (progress, data, cb) {
            progress(100);
            data.getConfigInfo = true;
            cb(null, data);
        },

        fetchData: function (progress, data, cb) {
            progress(100);
            data.fetchData = true;
            cb(null, data);
        },

        processData: function (progress, data, cb) {
            progress(40);
            setTimeout(function() {
                progress(100);
                data.processData = true;
                cb(null, data);
            }, Math.random() * 10000);
        },

        uploadData: function (progress, data, cb) {
            progress(100);
            data.uploadData = true;
            cb(null, data);
        },

        disconnect: function (progress, data, cb) {
            progress(100);
            data.disconnect = true;
            cb(null, data);
        },

        cleanup: function (progress, data, cb) {
            progress(100);
            data.cleanup = true;
            cb(null, data);
        }
    };
};