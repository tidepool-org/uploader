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
var appState = require('./appState');

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
    api.init.bind(null)
  ], function(err, results) {
    if (err) {
      return cb(err);
    }

    var session = results[2];
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

    device.upload(driverId, options, function(err, result) {
      if (err) {
        return self._handleUploadError(err, cb);
      }

      result = result || [];
      self.app.setState({
        upload: _.assign(self.app.state.upload || {}, {
          success: true,
          count: result.length
        })
      });

      return cb(null, result);
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

module.exports = appActions;
