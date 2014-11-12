/**
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
 */

// Wrapper around the Tidepool client library
var bows = require('bows');

var createTidepoolClient = require('tidepool-platform-client');
var tidepool;

var api = {
  log: bows('Api')
};

/*

*/
api.init = function(config,cb) {
  var tidepoolLog = bows('Tidepool');
  tidepool = createTidepoolClient({
    host: config.API_HOST,
    uploadApi: config.UPLOAD_API,
    log: {
      warn: tidepoolLog,
      info: tidepoolLog,
      debug: tidepoolLog
    },
    localStore: window.localStorage,
    metricsSource: 'chrome-uploader',
    metricsVersion: config.VERSION
  });

  api.tidepool = tidepool;

  tidepool.initialize(function() {
    cb();
  });
};

// ----- User -----

api.user = {};

api.user.isAuthenticated = function() {
  return tidepool.isLoggedIn();
};

api.user.login = function(user, options, cb) {
  api.log('POST /user/login');

  options = options || {};
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  tidepool.login(user, options, function(err, data) {
    if (err) {
      return cb(err);
    }

    cb();
  });
};

api.user.logout = function(cb) {
  api.log('POST /user/logout');

  if (!api.user.isAuthenticated()) {
    return;
  }

  tidepool.logout(function(err) {
    if (err) {
      return cb(err);
    }

    cb();
  });
};

// ----- Upload -----

api.getUploadUrl = function() {
  return tidepool.getUploadUrl();
};

// ----- Metrics -----

api.metrics = {};

api.metrics.track = function(eventName, properties, cb) {
  api.log('GET /metrics/' + window.encodeURIComponent(eventName));

  return tidepool.trackMetric(eventName, properties, cb);
};

// ----- Errors -----

api.errors = {};

api.errors.log = function(error, message, properties) {
  api.log('POST /errors');

  return tidepool.logAppError(error, message, properties);
};

module.exports = api;
