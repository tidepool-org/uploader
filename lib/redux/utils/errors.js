/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015-2016, Tidepool Project
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

import _ from 'lodash';

export const errorText = {
  E_CARELINK_CREDS: 'Check your CareLink username and password',
  E_CARELINK_UPLOAD: 'Error processing & uploading CareLink data',
  E_DEVICE_UPLOAD: 'Something went wrong during device upload',
  E_FETCH_CARELINK: 'Something went wrong trying to fetch CareLink data',
  E_FILE_EXT: 'Please choose a file ending in ',
  E_HID_CONNECTION: 'Hmm, your device doesn\'t appear to be connected',
  E_INIT: 'Error during app initialization',
  E_OFFLINE: 'Not connected to the Internet!',
  E_READ_FILE: 'Error reading file ',
  E_SERIAL_CONNECTION: 'Hmm, we couldn\'t detect your device',
  E_SERVER_ERR: 'Sorry, the Tidepool servers appear to be down',
  E_UPLOAD_IN_PROGRESS: 'Sorry, an upload is already in progress'
};

const errorProps = {
  code: 'Code',
  details: 'Details',
  name: 'Name',
  step: 'Driver Step',
  stringifiedStack: 'Stack Trace',
  utc: 'UTC Time',
  version: 'Version'
};

export function addInfoToError(err, props) {
  let debug = [];
  _.forOwn(props, (v, k) => {
    if (!_.isEmpty(v) && v !== err.message) {
      err[k] = v;
      debug.push(`${errorProps[k]}: ${v}`);
    }
  });
  if (!_.isEmpty(debug)) {
    err.debug = debug.join(' | ');
  }
  return err;
}

export function getAppInitErrorMessage(status) {
  switch(status) {
    case 503:
      return errorText.E_OFFLINE;
    default:
      return errorText.E_INIT;
  }
}

export function getLoginErrorMessage(status) {
  switch(status) {
    case 400:
      return 'We need your e-mail to log you in!';
    case 401:
      return 'Please check your e-mail and password.';
    default:
      return 'We couldn\'t log you in. Try again in a few minutes.';
  }
}

export function getLogoutErrorMessage() {
  return 'Sorry, error attempting to log out.';
}

export function createErrorLogger(api) {
  return ({ getState }) => (next) => (action) => {
    let err = _.get(action, 'payload', {});
    if (!err.debug) {
      err.debug = err.message || 'Unknown error';
    }
    if (_.get(action, 'error', false) === true) {
      api.errors.log(
       err,
        _.get(action, 'meta.metric.eventName', null),
        _.omit(_.get(action, 'meta.metric.properties', {}), 'error')
      );
    }
    return next(action);
  };
}

export function UnsupportedError(currentVersion, requiredVersion) {
  this.name = 'UnsupportedError';
  this.message = `Uploader version ${currentVersion} is no longer supported; version ${requiredVersion} or higher is required.`;
}

UnsupportedError.prototype = Object.create(Error.prototype);
UnsupportedError.prototype.constructor = UnsupportedError;
