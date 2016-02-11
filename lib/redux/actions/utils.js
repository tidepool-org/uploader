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

/* global __TEST__ */

import _ from 'lodash';
import stacktrace from 'stack-trace';

import sundial from 'sundial';

import { errorText } from '../utils/errors';
import * as syncActions from './sync';

export function getDeviceTargetsByUser(targetsByUser) {
  return _.mapValues(targetsByUser, (targets) => {
    return _.pluck(targets, 'key');
  });
}

export function getUploadTrackingId(device) {
  const source = device.source;
  if (source.type === 'device' || source.type === 'block') {
    return source.driverId;
  }
  if (source.type === 'carelink') {
    return 'CareLink';
  }
  return null;
}

export function getUtc(utc) {
  return _.isEmpty(utc) ? sundial.utcDateString() : utc;
}

export function makeProgressFn(dispatch, step, percentage) {
  return (step, percentage) => {
    dispatch(syncActions.uploadProgress(step, percentage));
  };
}

export function makeUploadCb(dispatch, getState, errCode, utc) {
  return (err, recs) => {
    const { devices, uploadsByUser, uploadTargetDevice, uploadTargetUser, version } = getState();
    const targetDevice = devices[uploadTargetDevice];
    if (err) {
      // the drivers sometimes just pass a string arg as err, instead of an actual error :/
      if (typeof err === 'string') {
        err = new Error(err);
      }
      const serverErr = 'Origin is not allowed by Access-Control-Allow-Origin';
      let displayErr = new Error(err.message === serverErr ?
        errorText.E_SERVER_ERR : errorText[errCode]);
      let uploadErrProps = {
        details: err.message,
        utc: getUtc(utc),
        name: err.name || 'Uncaught or API POST error',
        step: err.step || null,
        code: errCode,
        version: version
      };

      if (!__TEST__) {
        uploadErrProps.stringifiedStack = _.pluck(
          _.filter(
            stacktrace.parse(err),
            (cs) => { return cs.functionName !== null; }
          ),
          'functionName'
        ).join(', ');
      }
      return dispatch(syncActions.uploadFailure(displayErr, uploadErrProps, targetDevice));
    }
    const currentUpload = _.get(uploadsByUser, [uploadTargetUser, targetDevice.key], {});
    dispatch(syncActions.uploadSuccess(uploadTargetUser, targetDevice, currentUpload, recs, utc));

  };
}

export function viewDataPathForUser(uploadTargetUser) {
  return `/patients/${uploadTargetUser}/data`;
}
