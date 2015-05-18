var _ = require('lodash');
var async = require('async');
var moment = require('moment-timezone');
var sundial = require('sundial');
var crcCalculator = require('../crc.js');
var struct = require('../struct.js')();

module.exports = function (config) {
  var cfg = _.clone(config);
  //cfg.deviceData = null;


  return {
    // using the default detect for this driver
    // detect: function(cb) {
    // },

    // this function starts the chain, so it has to create but not accept
    // the result (data) object; it's then passed down the rest of the chain
    setup: function (deviceInfo, progress, cb) {
      console.log('in setup!');
      progress(100);

    },

    connect: function (progress, data, cb) {
      console.log('in connect!');
      progress(100);
            debug('in connect!');

      var handlers = {
        packetHandler: otu2MessageHandler,
        errorHandler: otu2ErrorHandler
      };

      //PV add some timeout - maybe there is a better place to set this
      //on manifest is not working
      data.deviceInfo.sendTimeout = 5000;
      data.deviceInfo.receiveTimeout = 5000;

      cfg.deviceComms.connect(data.deviceInfo, handlers, probe, function(err) {
        if (err) {
          return cb(err);
        }

        getSomeInfo({}, function (err, result) {
          progress(100);
          data.connect = true;
          _.assign(data, result);
          cb(null, data);
        });
      });
    },

    getConfigInfo: function (progress, data, cb) {
      // get the number of records

    },

    fetchData: function (progress, data, cb) {

    },

    processData: function (progress, data, cb) {

    },

    uploadData: function (progress, data, cb) {


    },

    disconnect: function (progress, data, cb) {

    },

    cleanup: function (progress, data, cb) {

    },

    testDriver: function(config) {

    }
  };
};
