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

import * as actionTypes from '../constants/actionTypes';
import * as actionSources from '../constants/actionSources';
import * as metrics from '../constants/metrics';
import { pages, paths, steps } from '../constants/otherConstants';

import { addInfoToError, getAppInitErrorMessage, getLoginErrorMessage, getLogoutErrorMessage, getUpdateProfileErrorMessage, getCreateCustodialAccountErrorMessage, UnsupportedError } from '../utils/errors';
import errorText from '../constants/errors';

import * as actionUtils from './utils';

export function addTargetDevice(userId, deviceKey) {
  return {
    type: actionTypes.ADD_TARGET_DEVICE,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.ADD_TARGET_DEVICE]}
  };
}

// NB: this action exists purely to trigger the metrics middleware
// no reducer responds to it to adjust any state!
export function clickGoToBlip() {
  return {
    type: actionTypes.CLICK_GO_TO_BLIP,
    meta: {
      source: actionSources[actionTypes.CLICK_GO_TO_BLIP],
      metric: {eventName: metrics.CLICK_GO_TO_BLIP}
    }
  };
}

export function hideUnavailableDevices(os) {
  return {
    type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
    payload: { os },
    meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
  };
}

export function removeTargetDevice(userId, deviceKey) {
  return {
    type: actionTypes.REMOVE_TARGET_DEVICE,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.REMOVE_TARGET_DEVICE]}
  };
}

export function resetUpload(userId, deviceKey) {
  return {
    type: actionTypes.RESET_UPLOAD,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.RESET_UPLOAD]}
  };
}

export function setBlipViewDataUrl(url) {
  return {
    type: actionTypes.SET_BLIP_VIEW_DATA_URL,
    payload: { url },
    meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
  };
}

export function setForgotPasswordUrl(url) {
  return {
    type: actionTypes.SET_FORGOT_PASSWORD_URL,
    payload: { url },
    meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
  };
}

export function setPage(page, actionSource = actionSources[actionTypes.SET_PAGE]) {
  return {
    type: actionTypes.SET_PAGE,
    payload: { page },
    meta: {source: actionSource}
  };
}

export function setSignUpUrl(url) {
  return {
    type: actionTypes.SET_SIGNUP_URL,
    payload: { url },
    meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
  };
}

export function setTargetTimezone(userId, timezoneName) {
  return {
    type: actionTypes.SET_TARGET_TIMEZONE,
    payload: { userId, timezoneName },
    meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]}
  };
}

export function setUploads(devicesByUser) {
  return {
    type: actionTypes.SET_UPLOADS,
    payload: { devicesByUser },
    meta: {source: actionSources[actionTypes.SET_UPLOADS]}
  };
}

export function setUploadTargetUser(userId) {
  return {
    type: actionTypes.SET_UPLOAD_TARGET_USER,
    payload: { userId },
    meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
  };
}

export function toggleDropdown(previous, actionSource = actionSources[actionTypes.TOGGLE_DROPDOWN]) {
  return {
    type: actionTypes.TOGGLE_DROPDOWN,
    payload: { isVisible: !previous },
    meta: {source: actionSource}
  };
}

export function toggleErrorDetails(userId, deviceKey, previous) {
  if (_.includes([null, undefined], previous)) {
    previous = false;
  }
  return {
    type: actionTypes.TOGGLE_ERROR_DETAILS,
    payload: { isVisible: !previous, userId, deviceKey },
    meta: {source: actionSources[actionTypes.TOGGLE_ERROR_DETAILS]}
  };
}

export function dismissUpdateProfileError(){
  return {
    type: actionTypes.DISMISS_UPDATE_PROFILE_ERROR,
    meta: {source: actionSources[actionTypes.DISMISS_UPDATE_PROFILE_ERROR]}
  };
}

export function dismissCreateCustodialAccountError(){
  return {
    type: actionTypes.DISMISS_CREATE_CUSTODIAL_ACCOUNT_ERROR,
    meta: {source: actionSources[actionTypes.DISMISS_CREATE_CUSTODIAL_ACCOUNT_ERROR]}
  };
}

export function setAllUsers(user, profile, memberships){
  return {
    type: actionTypes.SET_ALL_USERS,
    payload: { memberships: memberships, user: user, profile: profile },
    meta: {source: actionSources[actionTypes.SET_ALL_USERS]}
  };
}

/*
 * relating to async action creator doAppInit
 */

export function initRequest() {
  return {
    type: actionTypes.INIT_APP_REQUEST,
    meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
  };
}

export function initSuccess(session) {
  return {
    type: actionTypes.INIT_APP_SUCCESS,
    meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
  };
}

export function initFailure(err) {
  return {
    type: actionTypes.INIT_APP_FAILURE,
    error: true,
    payload: new Error(getAppInitErrorMessage(err.status || null)),
    meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
  };
}

export function setUserInfoFromToken(results) {
  const { user, profile, memberships } = results;
  return {
    type: actionTypes.SET_USER_INFO_FROM_TOKEN,
    payload: { user, profile, memberships },
    meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
  };
}

/*
 * relating to async action creator doLogin
 */

export function loginRequest() {
  return {
    type: actionTypes.LOGIN_REQUEST,
    meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
  };
}

export function loginSuccess(results) {
  const { user, profile, memberships } = results;
  return {
    type: actionTypes.LOGIN_SUCCESS,
    payload: { user, profile, memberships },
    meta: {
      source: actionSources[actionTypes.LOGIN_SUCCESS],
      metric: {eventName: metrics.LOGIN_SUCCESS}
    }
  };
}

export function loginFailure(errorCode) {
  return {
    type: actionTypes.LOGIN_FAILURE,
    error: true,
    payload: new Error(getLoginErrorMessage(errorCode)),
    meta: {source: actionSources[actionTypes.LOGIN_FAILURE]}
  };
}

/*
 * relating to async action creator doLogout
 */

export function logoutRequest() {
  return {
    type: actionTypes.LOGOUT_REQUEST,
    meta: {
      source: actionSources[actionTypes.LOGOUT_REQUEST],
      metric: {eventName: metrics.LOGOUT_REQUEST}
    }
  };
}

export function logoutSuccess() {
  return {
    type: actionTypes.LOGOUT_SUCCESS,
    meta: {source: actionSources[actionTypes.LOGOUT_SUCCESS]}
  };
}

export function logoutFailure() {
  return {
    type: actionTypes.LOGOUT_FAILURE,
    error: true,
    payload: new Error(getLogoutErrorMessage()),
    meta: {source: actionSources[actionTypes.LOGOUT_FAILURE]}
  };
}

/*
 * relating to async action creator doCareLinkUpload
 */

export function fetchCareLinkRequest(userId, deviceKey) {
  return {
    type: actionTypes.CARELINK_FETCH_REQUEST,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.CARELINK_FETCH_REQUEST]}
  };
}

export function fetchCareLinkSuccess(userId, deviceKey) {
  return {
    type: actionTypes.CARELINK_FETCH_SUCCESS,
    payload: { userId, deviceKey },
    meta: {
      source: actionSources[actionTypes.CARELINK_FETCH_SUCCESS],
      metric: {eventName: metrics.CARELINK_FETCH_SUCCESS}
    }
  };
}

export function fetchCareLinkFailure(message) {
  return {
    type: actionTypes.CARELINK_FETCH_FAILURE,
    error: true,
    payload: new Error(message),
    meta: {
      source: actionSources[actionTypes.CARELINK_FETCH_FAILURE],
      metric: {eventName: metrics.CARELINK_FETCH_FAILURE}
    }
  };
}

/*
 * relating to async action creator doUpload
 */

export function uploadAborted() {
  return {
    type: actionTypes.UPLOAD_ABORTED,
    error: true,
    payload: new Error(errorText.E_UPLOAD_IN_PROGRESS),
    meta: {source: actionSources[actionTypes.UPLOAD_ABORTED]}
  };
}

export function uploadRequest(userId, device, utc) {
  utc = actionUtils.getUtc(utc);
  return {
    type: actionTypes.UPLOAD_REQUEST,
    payload: { userId, deviceKey: device.key, utc },
    meta: {
      source: actionSources[actionTypes.UPLOAD_REQUEST],
      metric: {
        eventName: `${metrics.UPLOAD_REQUEST} ${actionUtils.getUploadTrackingId(device)}`,
        properties: {
          type: _.get(device, 'source.type', undefined),
          source: _.get(device, 'source.driverId', undefined)
        }
      }
    }
  };
}

export function uploadProgress(step, percentage) {
  return {
    type: actionTypes.UPLOAD_PROGRESS,
    payload: { step, percentage },
    meta: {source: actionSources[actionTypes.UPLOAD_PROGRESS]}
  };
}

export function uploadSuccess(userId, device, upload, data, utc) {
  utc = actionUtils.getUtc(utc);
  const numRecs = data.length;
  return {
    type: actionTypes.UPLOAD_SUCCESS,
    payload: { userId, deviceKey: device.key, data, utc },
    meta: {
      source: actionSources[actionTypes.UPLOAD_SUCCESS],
      metric: {
        eventName: `${metrics.UPLOAD_SUCCESS} ${actionUtils.getUploadTrackingId(device)}`,
        properties: {
          type: _.get(device, 'source.type', undefined),
          source: _.get(device, 'source.driverId', undefined),
          started: upload.history[0].start || '',
          finished: utc || '',
          processed: numRecs || 0
        }
      }
    }
  };
}

export function uploadFailure(err, errProps, device) {
  err = addInfoToError(err, errProps);
  return {
    type: actionTypes.UPLOAD_FAILURE,
    error: true,
    payload: err,
    meta: {
      source: actionSources[actionTypes.UPLOAD_FAILURE],
      metric: {
        eventName: `${metrics.UPLOAD_FAILURE} ${actionUtils.getUploadTrackingId(device)}`,
        properties: {
          type: _.get(device, 'source.type', undefined),
          source: _.get(device, 'source.driverId', undefined),
          error: err
        }
      }
    }
  };
}

export function deviceDetectRequest() {
  return {
    type: actionTypes.DEVICE_DETECT_REQUEST,
    meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
  };
}

/*
 * relating to async action creator readFile
 */

export function choosingFile(userId, deviceKey) {
  return {
    type: actionTypes.CHOOSING_FILE,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.CHOOSING_FILE]}
  };
}

export function readFileAborted(err, errProps) {
  return {
    type: actionTypes.READ_FILE_ABORTED,
    error: true,
    payload: addInfoToError(err, errProps),
    meta: {source: actionSources[actionTypes.READ_FILE_ABORTED]}
  };
}

export function readFileRequest(userId, deviceKey, filename) {
  return {
    type: actionTypes.READ_FILE_REQUEST,
    payload: { userId, deviceKey, filename },
    meta: {source: actionSources[actionTypes.READ_FILE_REQUEST]}
  };
}

export function readFileSuccess(userId, deviceKey, filedata) {
  return {
    type: actionTypes.READ_FILE_SUCCESS,
    payload: { userId, deviceKey, filedata },
    meta: {source: actionSources[actionTypes.READ_FILE_SUCCESS]}
  };
}

export function readFileFailure(err, errProps) {
  return {
    type: actionTypes.READ_FILE_FAILURE,
    error: true,
    payload: addInfoToError(err, errProps),
    meta: {source: actionSources[actionTypes.READ_FILE_FAILURE]}
  };
}

/*
 * relating to async action creator doVersionCheck
 */

export function versionCheckRequest() {
  return {
    type: actionTypes.VERSION_CHECK_REQUEST,
    meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
  };
}

export function versionCheckSuccess() {
  return {
    type: actionTypes.VERSION_CHECK_SUCCESS,
    meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
  };
}

export function versionCheckFailure(err, currentVersion, requiredVersion) {
  if (err != null) {
    return {
      type: actionTypes.VERSION_CHECK_FAILURE,
      error: true,
      payload: err,
      meta: {source: actionSources[actionTypes.VERSION_CHECK_FAILURE]}
    };
  }
  else {
    return {
      type: actionTypes.VERSION_CHECK_FAILURE,
      error: true,
      payload: new UnsupportedError(currentVersion, requiredVersion),
      meta: {
        source: actionSources[actionTypes.VERSION_CHECK_FAILURE],
        metric: {
          eventName: metrics.VERSION_CHECK_FAILURE_OUTDATED,
          properties: { requiredVersion }
        }
      }
    };
  }
}

/*
 * relating to updateProfile
 */

export function updateProfileRequest() {
  return {
    type: actionTypes.UPDATE_PROFILE_REQUEST,
    meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
  };
}

export function updateProfileSuccess() {
  return {
    type: actionTypes.UPDATE_PROFILE_SUCCESS,
    meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
  };
}

export function updateProfileFailure(err) {
  return {
    type: actionTypes.UPDATE_PROFILE_FAILURE,
    error: true,
    payload: new Error(getUpdateProfileErrorMessage(err.status || null)),
    meta: {source: actionSources[actionTypes.UPDATE_PROFILE_FAILURE]}
  };
}

/*
 * relating to createCustodialAccount
 */

export function createCustodialAccountRequest() {
  return {
    type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST,
    meta: {source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST]}
  };
}

export function createCustodialAccountSuccess(account) {
  return {
    type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS,
    payload: { account },
    meta: {source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS]}
  };
}

export function createCustodialAccountFailure(err) {
  return {
    type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE,
    error: true,
    payload: new Error(getCreateCustodialAccountErrorMessage(err.status || null)),
    meta: {source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE]}
  };
}

/*
 * relating to side-effect-performing action creators
 * retrieveTargetsFromStorage
 */

export function retrieveUsersTargetsFromStorage() {
  return {
    type: actionTypes.RETRIEVING_USERS_TARGETS,
    meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
  };
}

export function setUsersTargets(targets) {
  return {
    type: actionTypes.SET_USERS_TARGETS,
    payload: { targets },
    meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
  };
}
