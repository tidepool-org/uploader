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
import { combineReducers } from 'redux';

import * as actionTypes from '../constants/actionTypes';
import { UnsupportedError } from '../utils/errors';

import initialDevices from './devices';

export function devices(state = initialDevices, action) {
  switch (action.type) {
    case actionTypes.HIDE_UNAVAILABLE_DEVICES:
      function filterOutUnavailable(os) {
        let filteredDevices = {};
        _.each(state, (device) => {
          if (device.enabled[os] === true) {
            filteredDevices[device.key] = device;
          }
        });
        return filteredDevices;
      }
      return filterOutUnavailable(action.payload.os);
    default:
      return state;
  }
}

export function dropdown(state = false, action) {
  switch (action.type) {
    case actionTypes.TOGGLE_DROPDOWN:
      return action.payload.isVisible;
    case actionTypes.LOGOUT_REQUEST:
      return false;
    default:
      return state;
  }
}

export function os(state = null, action) {
  switch (action.type) {
    case actionTypes.SET_OS:
      return action.payload.os;
    default:
      return state;
  }
}

export function unsupported(state = true, action) {
  switch (action.type) {
    case actionTypes.INIT_APP_FAILURE:
    case actionTypes.VERSION_CHECK_FAILURE:
      const err = action.payload;
      if (err instanceof UnsupportedError) {
        return true;
      }
      else {
        return err;
      }
    case actionTypes.VERSION_CHECK_SUCCESS:
      return false;
    default:
      return state;
  }
}

export function blipUrls(state = {}, action) {
  switch (action.type) {
    case actionTypes. SET_BLIP_VIEW_DATA_URL:
      return _.assign({}, state, {
        viewDataLink: action.payload.url
      });
    case actionTypes.SET_FORGOT_PASSWORD_URL:
      return _.assign({}, state, {
        forgotPassword: action.payload.url
      });
    case actionTypes.SET_SIGNUP_URL:
      return _.assign({}, state, {
        signUp: action.payload.url
      });
    case actionTypes.SET_NEW_PATIENT_URL:
      return _.assign({}, state, {
        newPatient: action.payload.url
      });
    default:
      return state;
  }
}

function checkingVersion(state = false, action) {
  switch (action.type) {
    case actionTypes.VERSION_CHECK_FAILURE:
    case actionTypes.VERSION_CHECK_SUCCESS:
      return false;
    case actionTypes.VERSION_CHECK_REQUEST:
      return true;
    default:
      return state;
  }
}

function fetchingUserInfo(state = false, action) {
  switch (action.type) {
    case actionTypes.LOGIN_FAILURE:
    case actionTypes.LOGIN_SUCCESS:
      return false;
    case actionTypes.LOGIN_REQUEST:
      return true;
    default:
      return state;
  }
}

function initializingApp(state = true, action) {
  switch (action.type) {
    case actionTypes.INIT_APP_FAILURE:
    case actionTypes.INIT_APP_SUCCESS:
      return false;
    case actionTypes.INIT_APP_REQUEST:
      return true;
    default:
      return state;
  }
}

function uploading(state = false, action) {
  switch (action.type) {
    case actionTypes.UPLOAD_REQUEST:
      return true;
    case actionTypes.READ_FILE_ABORTED:
    case actionTypes.READ_FILE_FAILURE:
    case actionTypes.UPLOAD_FAILURE:
    case actionTypes.UPLOAD_SUCCESS:
    case actionTypes.UPLOAD_CANCELLED:
      return false;
    default:
      return state;
  }
}

function checkingElectronUpdate(state = false, action) {
  switch (action.type) {
    case actionTypes.CHECKING_FOR_UPDATES:
    case actionTypes.AUTO_UPDATE_CHECKING_FOR_UPDATES:
    case actionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return true;
    case actionTypes.UPDATE_AVAILABLE:
    case actionTypes.UPDATE_NOT_AVAILABLE:
    case actionTypes.AUTOUPDATE_ERROR:
      return false;
    default:
      return state;
  }
}

function checkingDriverUpdate(state = false, action) {
  switch (action.type) {
    case actionTypes.CHECKING_FOR_DRIVER_UPDATE:
      return true;
    case actionTypes.DRIVER_UPDATE_AVAILABLE:
    case actionTypes.DRIVER_UPDATE_NOT_AVAILABLE:
      return false;
    default:
      return state;
  }
}

export const working = combineReducers({
  checkingVersion, fetchingUserInfo, initializingApp, uploading, checkingElectronUpdate, checkingDriverUpdate
});

export function electronUpdateManualChecked(state = null, action) {
  switch (action.type) {
    case actionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return true;
    case actionTypes.DISMISS_UPDATE_NOT_AVAILABLE:
      return null;
    default:
      return state;
  }
}

export function electronUpdateAvailableDismissed(state = null, action) {
  switch (action.type) {
    case actionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return null;
    case actionTypes.DISMISS_UPDATE_AVAILABLE:
      return true;
    default:
      return state;
  }
}

export function electronUpdateAvailable(state = null, action) {
  switch (action.type) {
    case actionTypes.AUTO_UPDATE_CHECKING_FOR_UPDATES:
    case actionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return null;
    case actionTypes.UPDATE_AVAILABLE:
      return true;
    case actionTypes.UPDATE_NOT_AVAILABLE:
      return false;
    default:
      return state;
  }
}

export function electronUpdateDownloaded(state = null, action) {
  switch (action.type) {
    case actionTypes.UPDATE_AVAILABLE:
      return null;
    case actionTypes.UPDATE_DOWNLOADED:
      return true;
    case actionTypes.AUTOUPDATE_ERROR:
      return false;
    default:
      return state;
  }
}

export function driverUpdateAvailable(state = null, action) {
  switch (action.type) {
    case actionTypes.DRIVER_UPDATE_AVAILABLE:
      return action.payload;
    case actionTypes.DRIVER_UPDATE_NOT_AVAILABLE:
    case actionTypes.DRIVER_INSTALL:
      return false;
    default:
      return state;
  }
}

export function driverUpdateAvailableDismissed(state = null, action) {
  switch (action.type) {
    case actionTypes.CHECKING_FOR_DRIVER_UPDATE:
      return false;
    case actionTypes.DISMISS_DRIVER_UPDATE_AVAILABLE:
      return true;
    default:
      return state;
  }
}

export function driverUpdateShellOpts(state = null, action) {
  switch (action.type) {
    case actionTypes.DRIVER_INSTALL_SHELL_OPTS:
      return action.payload;
    default:
      return state;
  }
}

export function driverUpdateComplete(state = null, action) {
  switch (action.type) {
    case actionTypes.DRIVER_INSTALL:
      return true;
    default:
      return state;
  }
}

export function showingDeviceTimePrompt(state = null, action) {
  switch (action.type) {
    case actionTypes.DEVICE_TIME_INCORRECT:
      return { callback: action.payload.callback, cfg: action.payload.cfg, times: action.payload.times };
    case actionTypes.DISMISS_DEVICE_TIME_PROMPT:
      return false;
    default:
      return state;
  }
}

export function isTimezoneFocused(state = false, action) {
  switch (action.type) {
    case actionTypes.UPLOAD_CANCELLED:
      return true;
    case actionTypes.TIMEZONE_BLUR:
    case actionTypes.UPLOAD_REQUEST:
      return false;
    default:
      return state;
  }
}

export function showingAdHocPairingDialog(state = false, action) {
  switch (action.type) {
    case actionTypes.AD_HOC_PAIRING_REQUEST:
      return { callback: action.payload.callback, cfg: action.payload.cfg };
    case actionTypes.AD_HOC_PAIRING_DISMISSED:
      return false;
    default:
      return state;
  }
}
