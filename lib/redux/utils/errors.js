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
  E_INIT: 'Error during app initialization.',
  E_UPLOAD_IN_PROGRESS: 'Sorry, an upload is already in progress!',
  E_DEVICE_DETECT: 'Hmm, we couldn\'t detect your device.'
};

const errorProps = {
  code: 'Code',
  step: 'Driver Step',
  utc: 'UTC Time',
  version: 'Version'
};

export function addInfoToError(err, props) {
  let debug = [];
  _.forOwn(props, (v, k) => {
    if (v != null) {
      err[k] = v;
      debug.push(`${errorProps[k]}: ${v}`);
    }
  });
  err.debug = debug.join(' | ');
  return err;
}

export function getLoginErrorMessage(status) {
  switch(status) {
    case 400:
      return 'Sorry, I need a username to log you in!';
    case 401:
      return 'Login error! Check your username and password.';
    default:
      return 'Sorry, error attempting to log in.';
  }
}

export function getLogoutErrorMessage() {
  return 'Sorry, error attempting to log out.';
}

export function createErrorLogger(api) {
  return ({ getState }) => (next) => (action) => {
    if (_.get(action, 'error', false) === true) {
      api.errors.log(
        _.get(action, 'payload.debug', ''),
        _.get(action, 'payload.message', ''),
        _.get(action, 'payload.properties', {})
      );
    }
    return next(action);
  };
}
