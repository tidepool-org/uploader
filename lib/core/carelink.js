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

var driverManager = require('../driverManager');
var pwdSimulator = require('../carelink/carelinkSimulator.js');
var carelinkDriver = require('../drivers/carelinkDriver');

var carelink = {
  log: require('../bows')('Carelink')
};

carelink.init = function(options, cb) {
  options = options || {};
  this._defaultTimezone = options.defaultTimezone;
  this._api = options.api;
  cb();
};

carelink._createDriverManager = function(data, options) {
  options = options || {};
  var timezone = options.timezone || this._defaultTimezone;

  var drivers = {
    'Carelink': carelinkDriver(pwdSimulator, this._api)
  };
  var configs = {
    'Carelink': {
      fileData: data,
      timezone: timezone,
      progress: options.progress,
      version: options.version,
      groupId: options.targetId
    }
  };

  return driverManager(drivers, configs);
};

carelink.upload = function(data, options, cb) {
  var dm = this._createDriverManager(data, options);
  dm.process('Carelink', function(err, result) {
    if (err) {
      return cb(err);
    }
    return cb(null, result.post_records);
  });
};

module.exports = carelink;
