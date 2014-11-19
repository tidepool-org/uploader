/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var _ = require('lodash');
var async = require('async');
var localStore = require('../core/localStore');
var api = require('../core/api');
var jellyfish = require('../jellyfishClient.js')({tidepoolServer: api});
var device = require('../core/device');
var carelink = require('../core/carelink');
var appState = require('./appState');

var config = require('../config');

var appActions = {};

appActions.bindApp = function(app) {
  this.app = app;
  return this;
};

appActions.load = function(cb) {
  var self = this;
  var loadLocalStore = function(cb) {
    localStore.init(localStore.getInitialState(), function() {
      cb();
    });
  };

  async.series([
    loadLocalStore,
    device.init.bind(device, {jellyfish: jellyfish}),
    carelink.init.bind(carelink, {jellyfish: jellyfish}),
    api.init.bind(null)
  ], function(err, results) {
    if (err) {
      return cb(err);
    }

    var session = results[3];
    if (!session) {
      self.app.setState({
        page: 'login'
      });
      return cb();
    }

    async.series([
      api.user.account.bind(null),
      api.user.profile.bind(null)
    ], function(err, results) {
      var account = results[0];
      var profile = results[1];
      var user = _.assign(account, {profile: profile});

      self.app.setState({
        user: user,
        page: 'main'
      });

      return cb(null, user);
    });
  });
};

appActions.login = function(credentials, options, cb) {
  var self = this;
  async.series([
    api.user.login.bind(null, credentials, options),
    api.user.profile.bind(null)
  ], function(err, results) {
    if (err) {
      return cb(err);
    }
    var account = results[0].user;
    var profile = results[1];
    var user = _.assign(account, {profile: profile});

    self.app.setState({
      user: user,
      page: 'main'
    });

    return cb(null, user);
  });
};

appActions.logout = function(cb) {
  var self = this;
  api.user.logout(function(err) {
    if (err) {
      return cb(err);
    }

    self.app.setState(_.assign(appState.getInitial(), {
      page: 'login'
    }));

    return cb();
  });
};

appActions.detectDevices = function(cb) {
  var self = this;
  device.detectAll(function(err, devices) {
    if (err) {
      return cb(err);
    }

    self.app.setState({
      devices: devices
    });

    return cb(null, devices);
  });
};

appActions.openUpload = function(upload) {
  this.app.setState({
    page: 'upload',
    upload: _.cloneDeep(upload),
    progress: null
  });
};

appActions.closeUpload = function() {
  var history = this.app.state.history;
  if (appState.isUploadFinished()) {
    history.push(_.cloneDeep(this.app.state.upload));
  }
  this.app.setState({
    page: 'main',
    upload: null,
    progress: null,
    history: history
  });
};

appActions.uploadDevice = function(driverId, options, cb) {
  var self = this;
  options.progress = this._setUploadProgress.bind(this);

  device.detect(driverId, function(err, d) {
    if (err) {
      return self._handleUploadError(err, cb);
    }

    if (!d) {
      err = new Error('Device "' + driverId + '" doesn\'t appear to be connected');
      return self._handleUploadError(err, cb);
    }

    device.upload(driverId, options, function(err, records) {
      if (err) {
        return self._handleUploadError(err, cb);
      }

      records = records || [];
      self.app.setState({
        upload: _.assign(self.app.state.upload || {}, {
          success: true,
          count: records.length
        })
      });

      return cb(null, records);
    });
  });
};

appActions._setUploadProgress = function(step, percentage) {
  this.app.setState({
    progress: {step: step, percentage: percentage}
  });
};

appActions._handleUploadError = function(err, cb) {
  this.app.setState({
    upload: _.assign(this.app.state.upload || {}, {
      success: false,
      error: err
    })
  });
  cb(err);
};

appActions.uploadCarelink = function(credentials, options, cb) {
  var self = this;
  var payload = {
    carelinkUsername: credentials.username,
    carelinkPassword: credentials.password,
    daysAgo: config.DEFAULT_CARELINK_DAYS
  };
  options.progress = this._setUploadProgress.bind(this);

  this._setUploadProgress('download', 0);

  /*
  console.log('Carelink FetchData!');

        var formData = {carelinkUsername: cfg.username, carelinkPassword: cfg.password, daysAgo: '180'};

        tidepoolApi.upload.careLink(formData, function(err, task){
           if (err) {
              return cb(err);
            }

            var dataId = JSON.parse(task.text)._id;

            if (dataId === '') {
              return cb({message:'no id returned'});
            }

            tidepoolApi.fetch.careLink(dataId, function(err, data){
              if (err ) {
                return cb(err);
              }

              var endOfPreamble = data.indexOf('Index');
              // Setup the preamble to have everything up to the header line
              payload.preamble = csv.parse(data.substr(0, endOfPreamble), {});
              // Store the rest of the data
              payload.theData = csv.parse(data.substr(endOfPreamble), {
                header: true,
                dynamicTyping: true
              }).data;

              for (var i = 0; i < payload.theData.length; ++i) {
                convertRawValues(payload.theData[i]);
                payload.theData[i].deviceTime = sundial.parseAndApplyTimezone(payload.theData[i]['Timestamp'], CARELINK_TS_FORMAT);
              }

              payload.theData.sort(function(lhs, rhs){
                if (lhs.deviceTime < rhs.deviceTime) {
                  return -1;
                } else if (lhs.deviceTime > rhs.deviceTime) {
                  return 1;
                } else if (lhs['Raw-ID'] < rhs['Raw-ID']) {
                  return -1;
                } else if (lhs['Raw-ID'] > rhs['Raw-ID']) {
                  return 1;
                }
                return 0;
              });

              progress(100);
              return cb(null, payload);
            });
        });
  */

  api.upload.fetchCarelinkData(payload, function(err, data) {
    if (err) {
      return self._handleUploadError(err, cb);
    }

    self._setUploadProgress('download', 3);
    carelink.upload(data, options, function(err, records) {
      if (err) {
        return self._handleUploadError(err, cb);
      }

      records = records || [];
      self.app.setState({
        upload: _.assign(self.app.state.upload || {}, {
          success: true,
          count: records.length
        })
      });

      return cb(null, records);
    });
  });
};

module.exports = appActions;
