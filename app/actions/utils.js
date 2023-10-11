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

import _ from 'lodash';

import sundial from 'sundial';

import ErrorMessages from '../constants/errorMessages';
import * as syncActions from './sync';
import rollbar from '../../app/utils/rollbar';

const isBrowser = typeof window !== 'undefined';
// eslint-disable-next-line no-console
const debug = isBrowser ? require('bows')('utils') : console.log;
let osString = '';

export function getDeviceTargetsByUser(targetsByUser) {
  return _.mapValues(targetsByUser, (targets) => {
    return _.map(targets, 'key');
  });
}

export function getUploadTrackingId(device) {
  const {source} = device;
  if (source.type === 'device' || source.type === 'block') {
    return source.driverId;
  }
  return null;
}

export function getUtc(utc) {
  return _.isEmpty(utc) ? sundial.utcDateString() : utc;
}

export function makeProgressFn(dispatch) {
  return (step, percentage, isFirstUpload) => {
    dispatch(syncActions.uploadProgress(step, percentage, isFirstUpload));
  };
}

export function makeDisplayTimeModal(dispatch) {
  return (cb, cfg, times) => {
    dispatch(syncActions.deviceTimeIncorrect(cb, cfg, times));
  };
}

export function makeDisplayAdhocModal(dispatch) {
  return (cb, cfg) => {
    dispatch(syncActions.adHocPairingRequest(cb, cfg));
  };
}

export function makeDisplayBluetoothModal(dispatch) {
  return (cb, cfg) => {
    dispatch(syncActions.bluetoothPairingRequest(cb, cfg));
  };
}

export function makeUploadCb(dispatch, getState, errCode, utc) {
  return async (err, recs) => {
    const { devices, uploadsByUser, uploadTargetDevice, uploadTargetUser, version } = getState();
    const targetDevice = devices[uploadTargetDevice];

    if (err) {
      if(err === 'deviceTimePromptClose'){
        return dispatch(syncActions.uploadCancelled(getUtc(utc)));
      }
      // the drivers sometimes just pass a string arg as err, instead of an actual error :/
      if (typeof err === 'string') {
        err = new Error(err);
      }
      const serverErr = 'Origin is not allowed by Access-Control-Allow-Origin';
      let displayErr = new Error(err.message === serverErr ?
        ErrorMessages.E_SERVER_ERR : ErrorMessages[err.code || errCode]);
      let uploadErrProps = {
        details: err.message,
        utc: getUtc(utc),
        name: err.name || 'Uncaught or API POST error',
        step: err.step || null,
        datasetId: err.datasetId || null,
        requestTrace: err.requestTrace || null,
        sessionTrace: err.sessionTrace || null,
        code: err.code || errCode,
        version: version,
        data: recs
      };
      displayErr.originalError = err;

      if (errCode === 'E_BLUETOOTH_PAIR') {
        displayErr.message = 'Couldn\'t connect to device.';
        displayErr.link = 'https://support.tidepool.org/hc/en-us/articles/360035332972';
        displayErr.linkText = 'Is it paired?';
      }

      if (err.code === 'E_VERIO_WRITE') {
        displayErr.message = 'We couldn\'t communicate with the meter. You may need to give Uploader';
        displayErr.link = 'https://support.tidepool.org/hc/en-us/articles/4409628277140';
        displayErr.linkText = 'controlled folder access.';
      }

      if (err.code === 'E_VERIO_ACCESS') {
        displayErr.message = 'We couldn\'t communicate with the meter. You may need to give Uploader';
        displayErr.link = 'https://support.tidepool.org/hc/en-us/articles/360019872851#h_01F85RKK7MSTDYVW4QE2W8BKP8';
        displayErr.linkText = 'access to removable volumes.';
      }

      if (err.code === 'E_OMNIPOD_WRITE') {
        displayErr.message = 'We couldn\'t communicate with the PDM. You may need to give Uploader';
        displayErr.link = 'https://support.tidepool.org/hc/en-us/articles/360029448012#h_01FYCJ3XVYGBZJSJ8WPNETVEHX';
        displayErr.linkText = 'access to removable volumes.';
      }

      if (err.message === 'E_DATETIME_SET_BY_PUMP') {
        displayErr.message = ErrorMessages.E_DATETIME_SET_BY_PUMP;
        uploadErrProps.details = 'Incorrect date/time being synced from linked pump';
      }

      if (err.message === 'E_LIBREVIEW_FORMAT') {
        displayErr.message = ErrorMessages.E_LIBREVIEW_FORMAT;
        uploadErrProps.details = 'Could not validate the date format';
      }

      if (process.env.NODE_ENV !== 'test') {
        uploadErrProps = await sendToRollbar(displayErr, uploadErrProps);
      }
      return dispatch(syncActions.uploadFailure(displayErr, uploadErrProps, targetDevice));
    }
    const currentUpload = _.get(uploadsByUser, [uploadTargetUser, targetDevice.key], {});
    debug('Device model used for metrics:', recs.deviceModel);
    dispatch(syncActions.uploadSuccess(uploadTargetUser, targetDevice, currentUpload, recs, utc));
  };
}

export function viewDataPathForUser(uploadTargetUser) {
  return `/patients/${uploadTargetUser}/data`;
}

export function mergeProfileUpdates(profile, updates){
  // merge property values except arrays, which get replaced entirely
  return _.mergeWith(profile, updates, (original, update) => {
    if (_.isArray(original)) {
      return update;
    }
  });
}

export function sendToRollbar(err, props) {
  return new Promise((resolve) => {
    if (rollbar) {
      const extra = {};
      if (_.get(props, 'data.blobId', false)) {
        _.assign(extra, { blobId: props.data.blobId });
      }
      
      rollbar.error(err, extra, (err, data) => {
        if (err) {
          console.log('Error while reporting error to Rollbar:', err);
        } else {
          console.log(`Rollbar UUID: ${data.result.uuid}`);
          props.uuid = data.result.uuid;
        }
        resolve(props);
      });
    } else {
      resolve(props);
    }
  });
}

export async function initOSDetails() {
  if (typeof navigator !== 'undefined') {
    const ua = await navigator.userAgentData.getHighEntropyValues(
      ['platform', 'platformVersion', 'bitness']
    );

    let osVersion = ua.platformVersion;

    if (navigator.userAgentData.platform === 'Windows') {
      const majorPlatformVersion = parseInt(ua.platformVersion.split('.')[0]);
      if (majorPlatformVersion >= 13) {
        osVersion = '11';
      } else if (majorPlatformVersion > 0) {
        osVersion = '10';
      } else {
        osVersion = 'earlier than 10';
      }

      osVersion = `${osVersion} ${ua.bitness}-bit`;
    }
    
    osString = `${ua.platform} ${osVersion}`;
  }
}

export function getOSDetails() {
  return osString;
}
