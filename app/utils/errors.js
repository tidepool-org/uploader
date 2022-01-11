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

import ErrorMessages from '../constants/errorMessages';

const errorProps = {
  code: 'Code',
  details: 'Details',
  name: 'Name',
  step: 'Driver Step',
  datasetId: 'Dataset ID',
  requestTrace: 'Request Trace',
  sessionToken: 'Session Token',
  sessionTrace: 'Session Trace',
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
      return ErrorMessages.E_OFFLINE;
    default:
      return ErrorMessages.E_INIT;
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

export function getUpdateProfileErrorMessage(status) {
  switch (status) {
    case 400:
      return 'Something looks funky, make sure this account info is correct.';
    case 401:
      return 'You need to be logged in to update your preferences.';
    case 409:
      return 'This email is already associated with a Tidepool account.';
    case 503:
      return ErrorMessages.E_OFFLINE;
    default:
      return 'We can\'t save your device and timezone selection right now.';
  }
}

export function getCreateCustodialAccountErrorMessage(status){
  switch(status) {
    case 400:
      return 'Something looks funky, make sure this account info is correct.';
    case 401:
      return 'Your session timed out. You\'ll need to log back in.';
    case 409:
      return 'We can\'t create this account because that email address already has an account.';
    case 500:
      return 'Er sorry, we can\'t create this account right now. Try again in a few minutes. ';
    default:
      return 'Uh oh, we can\'t create this account. Try again in a few minutes and check your internet connection. ';
  }
}

export function getLogoutErrorMessage() {
  return 'Sorry, error attempting to log out.';
}

export function createErrorLogger(api) {
  return () => (next) => (action) => {
    if (_.get(action, 'error', false) === true) {
      let err = _.get(action, 'payload', {});
      if (!err.debug) {
        err.debug = err.message || 'Unknown error';
      }
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

UnsupportedError.prototype = _.create(Error.prototype);
UnsupportedError.prototype.constructor = UnsupportedError;
