/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

var sundial = require('sundial');
var _ = require('lodash');

var isBrowser = typeof window !== 'undefined';
var debug = isBrowser ? require('bows')('CommonFunctions') : console.log;
var rollbar = isBrowser ? require('../app/utils/rollbar') : null;

// the shared helpers moved to @tidepool/uploader-common; re-exported here so
// existing imports keep working
_.assign(exports, require('@tidepool/uploader-common/commonFunctions'));

// stays in the Uploader: needs the platform API and the device time modal
exports.checkDeviceTime = function (cfg, cb) {
  var { timezone, displayTimeModal } = cfg;
  var api = require('./core/api.js');
  api.getTime(function (err, result) {
    if (err) {
      return cb(err);
    }
    var serverTime = sundial.parseFromFormat(result);
    debug('Server time:', serverTime);

    if (isBrowser && cfg.deviceInfo.deviceTime != null) {
      var deviceTime = sundial.applyTimezone(cfg.deviceInfo.deviceTime, timezone);

      debug('Device time:', deviceTime);

      var FIFTEEN_MINUTES = 15 * 60 * 1000;
      if ( Math.abs(serverTime.valueOf()-deviceTime.valueOf()) > FIFTEEN_MINUTES ) {
        if (rollbar) {
          rollbar.info('Device time not set correctly or wrong timezone selected');
        }
        displayTimeModal(function (error) {
          if (error === 'deviceTimePromptClose' && rollbar) {
            rollbar.info('Upload cancelled after wrong device time warning');
          }
          return cb(error, serverTime);
        }, cfg, {serverTime, deviceTime});
        return;
      }
    } else {
      debug('Current device time not provided by driver.');
    }

    return cb(null, serverTime);
  });
};
