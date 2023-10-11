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

import * as ActionTypes from '../constants/actionTypes';
import * as actionSources from '../constants/actionSources';
import * as metrics from '../constants/metrics';

import {
  addInfoToError,
  getAppInitErrorMessage,
  getLoginErrorMessage,
  getLogoutErrorMessage,
  getUpdateProfileErrorMessage,
  getCreateCustodialAccountErrorMessage,
  UnsupportedError
} from '../utils/errors';
import ErrorMessages from '../constants/errorMessages';

import * as actionUtils from './utils';
import personUtils from '../../lib/core/personUtils';
import uploadDataPeriod from '../utils/uploadDataPeriod';

const uploadDataPeriodLabels = {
  [uploadDataPeriod.PERIODS.ALL]: 'all data',
  [uploadDataPeriod.PERIODS.DELTA]: 'new data',
  [uploadDataPeriod.PERIODS.FOUR_WEEKS]: '4 weeks'
};

export function addTargetDevice(userId, deviceKey, selectedClinicId) {
  return {
    type: ActionTypes.ADD_TARGET_DEVICE,
    payload: { userId, deviceKey, selectedClinicId },
    meta: {source: actionSources[ActionTypes.ADD_TARGET_DEVICE]}
  };
}

// NB: this action exists purely to trigger the metrics middleware
// no reducer responds to it to adjust any state!
export function clickGoToBlip() {
  return {
    type: ActionTypes.CLICK_GO_TO_BLIP,
    meta: {
      source: actionSources[ActionTypes.CLICK_GO_TO_BLIP],
      metric: {eventName: metrics.CLICK_GO_TO_BLIP}
    }
  };
}

export function rememberMedtronicSerialNumber(serialNumber) {
  return {
    type: ActionTypes.MEDTRONIC_REMEMBER_SERIAL_NUMBER,
    meta: {
      source: actionSources[ActionTypes.MEDTRONIC_REMEMBER_SERIAL_NUMBER],
      metric: { eventName: metrics.MEDTRONIC_REMEMBER_SERIAL_NUMBER }
    }
  };
}

export function clinicAddMrn(){
  return {
    type: ActionTypes.CLINIC_ADD_MRN,
    meta: {
      source: actionSources[ActionTypes.CLINIC_ADD_MRN],
      metric: {eventName: metrics.CLINIC_ADD_MRN}
    }
  };
}

export function clinicAddEmail(){
  return {
    type: ActionTypes.CLINIC_ADD_EMAIL,
    meta: {
      source: actionSources[ActionTypes.CLINIC_ADD_EMAIL],
      metric: {eventName: metrics.CLINIC_ADD_EMAIL}
    }
  };
}

export function clinicAddDevice(deviceKey){
  return {
    type: ActionTypes.CLINIC_DEVICE_STORED,
    meta: {
      source: actionSources[ActionTypes.CLINIC_DEVICE_STORED],
      metric: {eventName: metrics.CLINIC_DEVICE_STORED + ' - ' + deviceKey}
    }
  };
}

export function clinicInvalidDate(errors){
  if (_.get(errors, 'year', false)) {
    return {
      type: ActionTypes.CLINIC_ADD_INVALID_DATE,
      meta: {
        source: actionSources[ActionTypes.CLINIC_ADD_INVALID_DATE],
        metric: {eventName: metrics.CLINIC_ADD_INVALID_DATE}
      }
    };
  }
}

export function hideUnavailableDevices(os) {
  return {
    type: ActionTypes.HIDE_UNAVAILABLE_DEVICES,
    payload: { os },
    meta: {source: actionSources[ActionTypes.HIDE_UNAVAILABLE_DEVICES]}
  };
}

export function removeTargetDevice(userId, deviceKey, selectedClinicId) {
  return {
    type: ActionTypes.REMOVE_TARGET_DEVICE,
    payload: { userId, deviceKey, selectedClinicId },
    meta: {source: actionSources[ActionTypes.REMOVE_TARGET_DEVICE]}
  };
}

export function resetUpload(userId, deviceKey) {
  return {
    type: ActionTypes.RESET_UPLOAD,
    payload: { userId, deviceKey },
    meta: {source: actionSources[ActionTypes.RESET_UPLOAD]}
  };
}

export function setBlipViewDataUrl(url) {
  return {
    type: ActionTypes.SET_BLIP_VIEW_DATA_URL,
    payload: { url },
    meta: {source: actionSources[ActionTypes.SET_BLIP_VIEW_DATA_URL]}
  };
}

export function setForgotPasswordUrl(url) {
  return {
    type: ActionTypes.SET_FORGOT_PASSWORD_URL,
    payload: { url },
    meta: {source: actionSources[ActionTypes.SET_FORGOT_PASSWORD_URL]}
  };
}

export function setNewPatientUrl(url) {
  return {
    type: ActionTypes.SET_NEW_PATIENT_URL,
    payload: { url },
    meta: {source: actionSources[ActionTypes.SET_NEW_PATIENT_URL]}
  };
}

export function setSignUpUrl(url) {
  return {
    type: ActionTypes.SET_SIGNUP_URL,
    payload: { url },
    meta: {source: actionSources[ActionTypes.SET_SIGNUP_URL]}
  };
}

export function setBlipUrl(url) {
  return {
    type: ActionTypes.SET_BLIP_URL,
    payload: { url },
    meta: {source: actionSources[ActionTypes.SET_BLIP_URL]}
  };
}

export function setTargetTimezone(userId, timezoneName, metric) {
  let meta = {source: actionSources[ActionTypes.SET_TARGET_TIMEZONE]};
  if (metric) {
    _.assign(meta, metric);
  }
  return {
    type: ActionTypes.SET_TARGET_TIMEZONE,
    payload: { userId, timezoneName },
    meta: meta
  };
}

export function setUploads(devicesByUser) {
  return {
    type: ActionTypes.SET_UPLOADS,
    payload: { devicesByUser },
    meta: {source: actionSources[ActionTypes.SET_UPLOADS]}
  };
}

export function setUploadTargetUser(userId, metric) {
  let meta = {source: actionSources[ActionTypes.SET_UPLOAD_TARGET_USER]};
  if (metric) {
    _.assign(meta, {metric});
  }
  return {
    type: ActionTypes.SET_UPLOAD_TARGET_USER,
    payload: { userId },
    meta
  };
}

export function toggleDropdown(previous, actionSource = actionSources[ActionTypes.TOGGLE_DROPDOWN]) {
  return {
    type: ActionTypes.TOGGLE_DROPDOWN,
    payload: { isVisible: !previous },
    meta: {source: actionSource}
  };
}

export function toggleErrorDetails(userId, deviceKey, previous) {
  if (_.includes([null, undefined], previous)) {
    previous = false;
  }
  return {
    type: ActionTypes.TOGGLE_ERROR_DETAILS,
    payload: { isVisible: !previous, userId, deviceKey },
    meta: {source: actionSources[ActionTypes.TOGGLE_ERROR_DETAILS]}
  };
}

export function dismissUpdateProfileError(){
  return {
    type: ActionTypes.DISMISS_UPDATE_PROFILE_ERROR,
    meta: {source: actionSources[ActionTypes.DISMISS_UPDATE_PROFILE_ERROR]}
  };
}

export function dismissCreateCustodialAccountError(){
  return {
    type: ActionTypes.DISMISS_CREATE_CUSTODIAL_ACCOUNT_ERROR,
    meta: {source: actionSources[ActionTypes.DISMISS_CREATE_CUSTODIAL_ACCOUNT_ERROR]}
  };
}

export function setAllUsers(user, profile, memberships){
  return {
    type: ActionTypes.SET_ALL_USERS,
    payload: { memberships: memberships, user: user, profile: profile },
    meta: {source: actionSources[ActionTypes.SET_ALL_USERS]}
  };
}

export function acknowledgeNotification(acknowledgedNotification) {
  return {
    type: ActionTypes.ACKNOWLEDGE_NOTIFICATION,
    payload: {
      acknowledgedNotification: acknowledgedNotification,
    },
  };
}

/*
 * relating to async action creator doAppInit
 */

export function initializeAppRequest() {
  return {
    type: ActionTypes.INIT_APP_REQUEST,
    meta: {source: actionSources[ActionTypes.INIT_APP_REQUEST]}
  };
}

export function initializeAppSuccess() {
  return {
    type: ActionTypes.INIT_APP_SUCCESS,
    meta: {source: actionSources[ActionTypes.INIT_APP_SUCCESS]}
  };
}

export function initializeAppFailure(err) {
  const error = new Error(getAppInitErrorMessage(err.status || null));
  error.originalError = err;
  return {
    type: ActionTypes.INIT_APP_FAILURE,
    error: true,
    payload: error,
    meta: {source: actionSources[ActionTypes.INIT_APP_FAILURE]}
  };
}

export function setUserInfoFromToken(results) {
  const { user, profile, memberships } = results;
  return {
    type: ActionTypes.SET_USER_INFO_FROM_TOKEN,
    payload: { user, profile, memberships },
    meta: {source: actionSources[ActionTypes.SET_USER_INFO_FROM_TOKEN]}
  };
}

/*
 * relating to async action creator doLogin
 */

export function loginRequest() {
  return {
    type: ActionTypes.LOGIN_REQUEST,
    meta: {source: actionSources[ActionTypes.LOGIN_REQUEST]}
  };
}

export function loginSuccess(results) {
  const { user, profile, memberships } = results;
  const isClinicAccount = personUtils.isClinicianAccount(user);
  if (isClinicAccount) {
    uploadDataPeriod.setPeriodMedtronic600(uploadDataPeriod.PERIODS.FOUR_WEEKS);
  }
  return {
    type: ActionTypes.LOGIN_SUCCESS,
    payload: { user, profile, memberships },
    meta: {
      source: actionSources[ActionTypes.LOGIN_SUCCESS],
      metric: {eventName: isClinicAccount ? metrics.CLINIC_LOGIN_SUCCESS : metrics.LOGIN_SUCCESS}
    }
  };
}

export function loginFailure(errorCode) {
  return {
    type: ActionTypes.LOGIN_FAILURE,
    error: true,
    payload: new Error(getLoginErrorMessage(errorCode)),
    meta: {source: actionSources[ActionTypes.LOGIN_FAILURE]}
  };
}

/*
 * relating to async action creator doLogout
 */

export function logoutRequest() {
  return {
    type: ActionTypes.LOGOUT_REQUEST,
    meta: {
      source: actionSources[ActionTypes.LOGOUT_REQUEST],
      metric: {eventName: metrics.LOGOUT_REQUEST}
    }
  };
}

export function logoutSuccess() {
  return {
    type: ActionTypes.LOGOUT_SUCCESS,
    meta: {source: actionSources[ActionTypes.LOGOUT_SUCCESS]}
  };
}

export function logoutFailure() {
  return {
    type: ActionTypes.LOGOUT_FAILURE,
    error: true,
    payload: new Error(getLogoutErrorMessage()),
    meta: {source: actionSources[ActionTypes.LOGOUT_FAILURE]}
  };
}

/*
 * relating to async action creator doUpload
 */

export function uploadAborted() {
  return {
    type: ActionTypes.UPLOAD_ABORTED,
    error: true,
    payload: new Error(ErrorMessages.E_UPLOAD_IN_PROGRESS),
    meta: {source: actionSources[ActionTypes.UPLOAD_ABORTED]}
  };
}

export function uploadRequest(userId, device, utc) {
  utc = actionUtils.getUtc(utc);
  const properties = {
    type: _.get(device, 'source.type', undefined),
    source: `${actionUtils.getUploadTrackingId(device)}`,
    os: `${actionUtils.getOSDetails()}`,
  };
  if (_.get(device, 'source.driverId', null) === 'Medtronic600') {
    _.extend(properties, { 'limit': uploadDataPeriodLabels[uploadDataPeriod.periodMedtronic600] });
  }
  return {
    type: ActionTypes.UPLOAD_REQUEST,
    payload: { userId, deviceKey: device.key, utc },
    meta: {
      source: actionSources[ActionTypes.UPLOAD_REQUEST],
      metric: {
        eventName: `${metrics.UPLOAD_REQUEST}`,
        properties
      }
    }
  };
}

export function uploadProgress(step, percentage, isFirstUpload) {
  return {
    type: ActionTypes.UPLOAD_PROGRESS,
    payload: { step, percentage, isFirstUpload },
    meta: {source: actionSources[ActionTypes.UPLOAD_PROGRESS]}
  };
}

export function uploadSuccess(userId, device, upload, data, utc) {
  utc = actionUtils.getUtc(utc);
  const numRecs = _.get(data, 'post_records.length', undefined);
  const properties = {
    type: _.get(device, 'source.type', undefined),
    deviceModel: _.get(data, 'deviceModel', undefined),
    source: `${actionUtils.getUploadTrackingId(device)}`,
    os: `${actionUtils.getOSDetails()}`,
    started: upload.history[0].start || '',
    finished: utc || '',
    processed: numRecs || 0
  };
  if (_.get(device, 'source.driverId', null) === 'Medtronic600') {
    _.extend(properties, { 'limit': uploadDataPeriodLabels[uploadDataPeriod.periodMedtronic600] });
  }
  return {
    type: ActionTypes.UPLOAD_SUCCESS,
    payload: { userId, deviceKey: device.key, data, utc },
    meta: {
      source: actionSources[ActionTypes.UPLOAD_SUCCESS],
      metric: {
        eventName: `${metrics.UPLOAD_SUCCESS}`,
        properties
      }
    }
  };
}

export function uploadFailure(err, errProps, device) {
  err = addInfoToError(err, errProps);
  const properties = {
    type: _.get(device, 'source.type', undefined),
    source: `${actionUtils.getUploadTrackingId(device)}`,
    os: `${actionUtils.getOSDetails()}`,
    error: err
  };
  if (_.get(device, 'source.driverId', null) === 'Medtronic600') {
    _.extend(properties, { 'limit': uploadDataPeriodLabels[uploadDataPeriod.periodMedtronic600] });
  }
  return {
    type: ActionTypes.UPLOAD_FAILURE,
    error: true,
    payload: err,
    meta: {
      source: actionSources[ActionTypes.UPLOAD_FAILURE],
      metric: {
        eventName: `${metrics.UPLOAD_FAILURE}`,
        properties
      }
    }
  };
}

export function uploadCancelled(utc) {
  return {
    type: ActionTypes.UPLOAD_CANCELLED,
    payload: { utc },
    meta: {
      source: actionSources[ActionTypes.UPLOAD_CANCELLED]
    }
  };
}

export function deviceDetectRequest() {
  return {
    type: ActionTypes.DEVICE_DETECT_REQUEST,
    meta: {source: actionSources[ActionTypes.DEVICE_DETECT_REQUEST]}
  };
}

/*
 * relating to async action creator readFile
 */

export function choosingFile(userId, deviceKey) {
  return {
    type: ActionTypes.CHOOSING_FILE,
    payload: { userId, deviceKey },
    meta: {source: actionSources[ActionTypes.CHOOSING_FILE]}
  };
}

export function readFileAborted(err, errProps) {
  return {
    type: ActionTypes.READ_FILE_ABORTED,
    error: true,
    payload: addInfoToError(err, errProps),
    meta: {source: actionSources[ActionTypes.READ_FILE_ABORTED]}
  };
}

export function readFileRequest(userId, deviceKey, filename) {
  return {
    type: ActionTypes.READ_FILE_REQUEST,
    payload: { userId, deviceKey, filename },
    meta: {source: actionSources[ActionTypes.READ_FILE_REQUEST]}
  };
}

export function readFileSuccess(userId, deviceKey, filedata) {
  return {
    type: ActionTypes.READ_FILE_SUCCESS,
    payload: { userId, deviceKey, filedata },
    meta: {source: actionSources[ActionTypes.READ_FILE_SUCCESS]}
  };
}

export function readFileFailure(err, errProps) {
  return {
    type: ActionTypes.READ_FILE_FAILURE,
    error: true,
    payload: addInfoToError(err, errProps),
    meta: {source: actionSources[ActionTypes.READ_FILE_FAILURE]}
  };
}

/*
 * relating to async action creator doVersionCheck
 */

export function versionCheckRequest() {
  return {
    type: ActionTypes.VERSION_CHECK_REQUEST,
    meta: {source: actionSources[ActionTypes.VERSION_CHECK_REQUEST]}
  };
}

export function versionCheckSuccess() {
  return {
    type: ActionTypes.VERSION_CHECK_SUCCESS,
    meta: {source: actionSources[ActionTypes.VERSION_CHECK_SUCCESS]}
  };
}

export function versionCheckFailure(err, currentVersion, requiredVersion) {
  if (err != null) {
    return {
      type: ActionTypes.VERSION_CHECK_FAILURE,
      error: true,
      payload: err,
      meta: {
        source: actionSources[ActionTypes.VERSION_CHECK_FAILURE],
        metric: {
          eventName: metrics.UNSUPPORTED_SCREEN_DISPLAYED
        }
      }
    };
  }
  else {
    return {
      type: ActionTypes.VERSION_CHECK_FAILURE,
      error: true,
      payload: new UnsupportedError(currentVersion, requiredVersion),
      meta: {
        source: actionSources[ActionTypes.VERSION_CHECK_FAILURE],
        metric: {
          eventName: metrics.VERSION_CHECK_FAILURE_OUTDATED,
          properties: { requiredVersion }
        }
      }
    };
  }
}

/*
 * relating to async action creator fetchInfo
 */

export function fetchInfoRequest() {
  return {
    type: ActionTypes.FETCH_INFO_REQUEST,
    meta: {source: actionSources[ActionTypes.FETCH_INFO_REQUEST]}
  };
}

export function fetchInfoSuccess(info) {
  return {
    payload: { info },
    type: ActionTypes.FETCH_INFO_SUCCESS,
    meta: {source: actionSources[ActionTypes.FETCH_INFO_SUCCESS]}
  };
}

export function fetchInfoFailure(err) {
  return {
    type: ActionTypes.FETCH_INFO_FAILURE,
    error: true,
    payload: err,
    meta: {
      source: actionSources[ActionTypes.FETCH_INFO_FAILURE]
    }
  };
}

/*
 * relating to updateProfile
 */

export function updateProfileRequest() {
  return {
    type: ActionTypes.UPDATE_PROFILE_REQUEST,
    meta: {source: actionSources[ActionTypes.UPDATE_PROFILE_REQUEST]}
  };
}

export function updateProfileSuccess(profile, userId) {
  return {
    type: ActionTypes.UPDATE_PROFILE_SUCCESS,
    payload: { profile, userId },
    meta: {source: actionSources[ActionTypes.UPDATE_PROFILE_SUCCESS]}
  };
}

export function updateProfileFailure(err) {
  const error = new Error(getUpdateProfileErrorMessage(err.status || null));
  error.originalError = err;
  return {
    type: ActionTypes.UPDATE_PROFILE_FAILURE,
    error: true,
    payload: error,
    meta: {source: actionSources[ActionTypes.UPDATE_PROFILE_FAILURE]}
  };
}

/*
 * relating to createCustodialAccount
 */

export function createCustodialAccountRequest() {
  return {
    type: ActionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST,
    meta: {source: actionSources[ActionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST]}
  };
}

export function createCustodialAccountSuccess(account) {
  return {
    type: ActionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS,
    payload: { account },
    meta: {
      source: actionSources[ActionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS],
      metric: {eventName: metrics.CLINIC_ADD_NEW_PATIENT}
    }
  };
}

export function createCustodialAccountFailure(err) {
  const error = new Error(getCreateCustodialAccountErrorMessage(err.status || null));
  error.originalError = err;
  return {
    type: ActionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE,
    error: true,
    payload: error,
    meta: {source: actionSources[ActionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE]}
  };
}

/*
 * relating to side-effect-performing action creators
 * retrieveTargetsFromStorage
 */

export function retrieveUsersTargetsFromStorage() {
  return {
    type: ActionTypes.RETRIEVING_USERS_TARGETS,
    meta: {source: actionSources[ActionTypes.RETRIEVING_USERS_TARGETS]}
  };
}

export function setUsersTargets(targets) {
  return {
    type: ActionTypes.SET_USERS_TARGETS,
    payload: { targets },
    meta: {source: actionSources[ActionTypes.SET_USERS_TARGETS]}
  };
}

/*
 * relating to electron auto-updater
 */

export function autoCheckingForUpdates() {
  return {
    type: ActionTypes.AUTO_UPDATE_CHECKING_FOR_UPDATES,
    meta: { source: actionSources[ActionTypes.AUTO_UPDATE_CHECKING_FOR_UPDATES] }
  };
}

export function manualCheckingForUpdates() {
  return {
    type: ActionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES,
    meta: { source: actionSources[ActionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES] }
  };
}

export function updateAvailable(info) {
  return {
    type: ActionTypes.UPDATE_AVAILABLE,
    payload: { info },
    meta: { source: actionSources[ActionTypes.UPDATE_AVAILABLE] }
  };
}

export function updateNotAvailable(info) {
  return {
    type: ActionTypes.UPDATE_NOT_AVAILABLE,
    payload: { info },
    meta: { source: actionSources[ActionTypes.UPDATE_NOT_AVAILABLE] }
  };
}

export function autoUpdateError(error) {
  return {
    type: ActionTypes.AUTOUPDATE_ERROR,
    payload: { error },
    meta: { source: actionSources[ActionTypes.AUTOUPDATE_ERROR] }
  };
}

export function updateDownloaded(info) {
  return {
    type: ActionTypes.UPDATE_DOWNLOADED,
    payload: { info },
    meta: { source: actionSources[ActionTypes.UPDATE_DOWNLOADED] }
  };
}

export function dismissUpdateAvailable() {
  return {
    type: ActionTypes.DISMISS_UPDATE_AVAILABLE,
    meta: { source: actionSources[ActionTypes.DISMISS_UPDATE_AVAILABLE] }
  };
}

export function dismissUpdateNotAvailable() {
  return {
    type: ActionTypes.DISMISS_UPDATE_NOT_AVAILABLE,
    meta: { source: actionSources[ActionTypes.DISMISS_UPDATE_NOT_AVAILABLE] }
  };
}

export function quitAndInstall() {
  return {
    type: ActionTypes.QUIT_AND_INSTALL,
    meta: {
      source: actionSources[ActionTypes.QUIT_AND_INSTALL],
      metric: { eventName: metrics.QUIT_AND_INSTALL }
    }
  };
}

/*
 * relating to driver updates
 */

export function checkingForDriverUpdate() {
  return {
    type: ActionTypes.CHECKING_FOR_DRIVER_UPDATE,
    meta: { source: actionSources[ActionTypes.CHECKING_FOR_DRIVER_UPDATE] }
  };
}

export function driverUpdateAvailable(current, available) {
  return {
    type: ActionTypes.DRIVER_UPDATE_AVAILABLE,
    payload: { current, available },
    meta: { source: actionSources[ActionTypes.DRIVER_UPDATE_AVAILABLE] }
  };
}

export function driverUpdateNotAvailable() {
  return {
    type: ActionTypes.DRIVER_UPDATE_NOT_AVAILABLE,
    meta: { source: actionSources[ActionTypes.DRIVER_UPDATE_NOT_AVAILABLE] }
  };
}

export function dismissDriverUpdateAvailable() {
  return {
    type: ActionTypes.DISMISS_DRIVER_UPDATE_AVAILABLE,
    meta: { source: actionSources[ActionTypes.DISMISS_DRIVER_UPDATE_AVAILABLE] }
  };
}

export function driverInstall() {
  return {
    type: ActionTypes.DRIVER_INSTALL,
    meta: {
      source: actionSources[ActionTypes.DRIVER_INSTALL]
    }
  };
}

export function driverUpdateShellOpts(opts) {
  return {
    type: ActionTypes.DRIVER_INSTALL_SHELL_OPTS,
    payload: { opts },
    meta: {source: actionSources[ActionTypes.DRIVER_INSTALL_SHELL_OPTS] }
  };
}

export function deviceTimeIncorrect(callback, cfg, times) {
  return {
    type: ActionTypes.DEVICE_TIME_INCORRECT,
    payload: { callback, cfg, times },
    meta: {
      source: actionSources[ActionTypes.DEVICE_TIME_INCORRECT],
      metric: {
        eventName: metrics.DEVICE_TIME_INCORRECT,
        properties: { times },
      }
    },
  };
}

export function dismissedDeviceTimePrompt() {
  return {
    type: ActionTypes.DISMISS_DEVICE_TIME_PROMPT,
    meta: { source: actionSources[ActionTypes.DISMISS_DEVICE_TIME_PROMPT] }
  };
}

export function timezoneBlur() {
  return {
    type: ActionTypes.TIMEZONE_BLUR,
    meta: { source: actionSources[ActionTypes.TIMEZONE_BLUR] }
  };
}

/*
* relating to ad hoc pairing dialog
*/

export function adHocPairingRequest(callback, cfg) {
  return {
    type: ActionTypes.AD_HOC_PAIRING_REQUEST,
    payload: { callback, cfg },
    meta: { source: actionSources[ActionTypes.AD_HOC_PAIRING_REQUEST] }
  };
}

export function dismissedAdHocPairingDialog() {
  return {
    type: ActionTypes.AD_HOC_PAIRING_DISMISSED,
    meta: { source: actionSources[ActionTypes.AD_HOC_PAIRING_DISMISSED] }
  };
}

export function bluetoothPairingRequest(callback, cfg) {
  return {
    type: ActionTypes.BLUETOOTH_PAIRING_REQUEST,
    payload: { callback, cfg },
    meta: { source: actionSources[ActionTypes.BLUETOOTH_PAIRING_REQUEST] }
  };
}

export function dismissedBluetoothPairingDialog() {
  return {
    type: ActionTypes.BLUETOOTH_PAIRING_DISMISSED,
    meta: { source: actionSources[ActionTypes.BLUETOOTH_PAIRING_DISMISSED] }
  };
}

export function fetchPatientsForClinicRequest() {
  return {
    type: ActionTypes.FETCH_PATIENTS_FOR_CLINIC_REQUEST,
  };
}

export function fetchPatientsForClinicSuccess(clinicId, patients, count) {
  return {
    type: ActionTypes.FETCH_PATIENTS_FOR_CLINIC_SUCCESS,
    payload: {
      clinicId,
      patients,
      count,
    },
  };
}

export function fetchPatientsForClinicFailure(error, apiError) {
  return {
    type: ActionTypes.FETCH_PATIENTS_FOR_CLINIC_FAILURE,
    error: error,
    meta: {
      apiError: apiError || null,
    },
  };
}

export function createClinicCustodialAccountRequest() {
  return {
    type: ActionTypes.CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST,
  };
}

export function createClinicCustodialAccountSuccess(clinicId, patient, patientId) {
  return {
    type: ActionTypes.CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS,
    payload: {
      clinicId,
      patient,
      patientId,
    },
    meta: {
      source: actionSources[ActionTypes.CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS],
      metric: {eventName: metrics.CLINIC_ADD_NEW_PATIENT}
    }
  };
}

export function createClinicCustodialAccountFailure(err, apiError) {
  const error = new Error(getCreateCustodialAccountErrorMessage(err.status || null));
  error.originalError = err;
  return {
    type: ActionTypes.CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE,
    error: error,
    meta: {
      apiError: apiError || null,
    },
  };
}

export function updateClinicPatientRequest() {
  return {
    type: ActionTypes.UPDATE_CLINIC_PATIENT_REQUEST,
  };
}

export function updateClinicPatientSuccess(clinicId, patientId, patient) {
  return {
    type: ActionTypes.UPDATE_CLINIC_PATIENT_SUCCESS,
    payload: {
      patientId,
      clinicId,
      patient
    },
  };
}

export function updateClinicPatientFailure(error, apiError) {
  const err = new Error(getUpdateProfileErrorMessage(error.status || null));
  err.originalError = error;
  return {
    type: ActionTypes.UPDATE_CLINIC_PATIENT_FAILURE,
    error: true,
    payload: err,
    meta: {
      apiError: apiError || null,
    },
  };
}

export function fetchPatientRequest() {
  return {
    type: ActionTypes.FETCH_PATIENT_REQUEST,
  };
}

export function fetchPatientSuccess(patient) {
  return {
    type: ActionTypes.FETCH_PATIENT_SUCCESS,
    payload: {
      patient: patient,
    },
  };
}

export function fetchPatientFailure(error, apiError, link) {
  return {
    type: ActionTypes.FETCH_PATIENT_FAILURE,
    error: error,
    payload: { link },
    meta: {
      apiError: apiError || null,
    },
  };
}

export function fetchAssociatedAccountsRequest() {
  return {
    type: ActionTypes.FETCH_ASSOCIATED_ACCOUNTS_REQUEST,
  };
}

export function fetchAssociatedAccountsSuccess(accounts) {
  return {
    type: ActionTypes.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS,
    payload: accounts,
  };
}

export function fetchAssociatedAccountsFailure(error, apiError) {
  return {
    type: ActionTypes.FETCH_ASSOCIATED_ACCOUNTS_FAILURE,
    error: error,
    meta: {
      apiError: apiError || null
    },
  };
}

export function getClinicsForClinicianRequest() {
  return {
    type: ActionTypes.GET_CLINICS_FOR_CLINICIAN_REQUEST,
  };
}

export function getClinicsForClinicianSuccess(clinics, clinicianId) {
  return {
    type: ActionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
    payload: {
      clinics: clinics,
      clinicianId
    },
  };
}

export function getClinicsForClinicianFailure(error, apiError) {
  return {
    type: ActionTypes.GET_CLINICS_FOR_CLINICIAN_FAILURE,
    error: error,
    meta: {
      apiError: apiError || null,
    },
  };
}

export function selectClinic(clinicId) {
  return {
    type: ActionTypes.SELECT_CLINIC,
    payload: {
      clinicId
    },
  };
}

export function fetchClinicMRNSettingsRequest() {
  return {
    type: ActionTypes.FETCH_CLINIC_MRN_SETTINGS_REQUEST,
  };
}

export function fetchClinicMRNSettingsSuccess(clinicId, settings) {
  return {
    type: ActionTypes.FETCH_CLINIC_MRN_SETTINGS_SUCCESS,
    payload: {
      clinicId,
      settings,
    },
  };
}

export function fetchClinicMRNSettingsFailure(error, apiError) {
  return {
    type: ActionTypes.FETCH_CLINIC_MRN_SETTINGS_FAILURE,
    error: error,
    meta: {
      apiError: apiError || null,
    },
  };
}

export function fetchClinicEHRSettingsRequest() {
  return {
    type: ActionTypes.FETCH_CLINIC_EHR_SETTINGS_REQUEST,
  };
}

export function fetchClinicEHRSettingsSuccess(clinicId, settings) {
  return {
    type: ActionTypes.FETCH_CLINIC_EHR_SETTINGS_SUCCESS,
    payload: {
      clinicId,
      settings,
    },
  };
}

export function fetchClinicEHRSettingsFailure(error, apiError) {
  return {
    type: ActionTypes.FETCH_CLINIC_EHR_SETTINGS_FAILURE,
    error: error,
    meta: {
      apiError: apiError || null,
    },
  };
}

export function keycloakReady(event, error, logoutUrl){
  return {
    type: ActionTypes.KEYCLOAK_READY,
    payload: { error, event, logoutUrl },
  };
}

export function keycloakInitError(event, error){
  return {
    type: ActionTypes.KEYCLOAK_INIT_ERROR,
    error: error,
    payload: { error, event },
  };
}

export function keycloakAuthSuccess(event, error) {
  return {
    type: ActionTypes.KEYCLOAK_AUTH_SUCCESS,
    payload: { error, event },
  };
}

export function keycloakAuthError(event, error){
  return {
    type: ActionTypes.KEYCLOAK_AUTH_ERROR,
    error: error,
    payload: { error, event },
  };
}

export function keycloakAuthRefreshSuccess(event, error) {
  return {
    type: ActionTypes.KEYCLOAK_AUTH_REFRESH_SUCCESS,
    payload: { event, error }
  };
}

export function keycloakAuthRefreshError(event, error) {
  return {
    type: ActionTypes.KEYCLOAK_AUTH_REFRESH_ERROR,
    error: error,
    payload: { error, event },
  };
}

export function keycloakTokenExpired(event, error) {
  return {
    type: ActionTypes.KEYCLOAK_TOKEN_EXPIRED,
    payload: { error, event },
  };
}

export function keycloakAuthLogout(event, error) {
  return {
    type: ActionTypes.KEYCLOAK_AUTH_LOGOUT,
    payload: { error, event },
  };
}

export function keycloakTokensReceived(tokens) {
  return {
    type: ActionTypes.KEYCLOAK_TOKENS_RECEIVED,
    payload: { tokens },
  };
}

export function setKeycloakRegistrationUrl(url){
  return {
    type: ActionTypes.SET_KEYCLOAK_REGISTRATION_URL,
    payload: { url },
  };
}

export function keycloakInstantiated(){
  return {
    type: ActionTypes.KEYCLOAK_INSTANTIATED
  };
}

export function keycloakReset(){
  return {
    type: ActionTypes.KEYCLOAK_RESET
  };
}
