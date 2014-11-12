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

var bows = require('bows');

var myConfig;

var api = {
  log: bows('Api')
};

api.init = function(config,cb) {
  var tidepoolLog = bows('Tidepool');
  myConfig = config;
  return cb();
};

// ----- User -----

api.user = {};

api.user.isAuthenticated = function() {
  return true;
};

api.user.login = function(user, options, cb) {
  api.log('POST /user/login');
  return cb();
};

api.user.logout = function(cb) {
  api.log('POST /user/logout');
  return cb();
};

// ----- Upload -----

api.getUploadUrl = function() {
  return config.UPLOAD_API;
};

// ----- Metrics -----

api.metrics = {};

api.metrics.track = function(eventName, properties, cb) {
  api.log('GET /metrics/' + window.encodeURIComponent(eventName));
  return cb();
};

// ----- Errors -----

api.errors = {};

api.errors.log = function(error, message, properties) {
  api.log('POST /errors');
  return;
};

module.exports = api;
