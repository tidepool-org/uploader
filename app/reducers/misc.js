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
import update from 'immutability-helper';

import initialState from './initialState';
import * as types from '../constants/actionTypes';
import { UnsupportedError } from '../utils/errors';
import actionWorkingMap from '../constants/actionWorkingMap';

import initialDevices from './devices';

export const notification = (state = initialState.notification, action) => {
  switch (action.type) {
    case types.FETCH_ASSOCIATED_ACCOUNTS_FAILURE:
    case types.FETCH_PATIENT_FAILURE:
    case types.LOGIN_FAILURE:
    case types.CREATE_CUSTODIAL_ACCOUNT_FAILURE:
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE:
      const err = _.get(action, 'error', null);
      if (err) {
        return {
          key: actionWorkingMap(action.type),
          isDismissible: true,
          link: _.get(action, ['payload', 'link'], null),
          status: _.get(err, 'status', null)
        };
      }
      else {
        return null;
      }
    case types.ACKNOWLEDGE_NOTIFICATION:
      return null;
    default:
      return state;
  }
};

export function devices(state = initialDevices, action) {
  switch (action.type) {
    case types.HIDE_UNAVAILABLE_DEVICES:
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

export function dropdown(state = initialState.dropdown, action) {
  switch (action.type) {
    case types.TOGGLE_DROPDOWN:
      return action.payload.isVisible;
    case types.LOGOUT_REQUEST:
      return initialState.dropdown;
    default:
      return state;
  }
}

export function os(state = initialState.os, action) {
  switch (action.type) {
    case types.SET_OS:
      return action.payload.os;
    default:
      return state;
  }
}

export function unsupported(state = initialState.unsupported, action) {
  switch (action.type) {
    case types.INIT_APP_FAILURE:
    case types.VERSION_CHECK_FAILURE:
      const err = action.payload;
      if (err instanceof UnsupportedError) {
        return true;
      }
      else {
        return err;
      }
    case types.VERSION_CHECK_SUCCESS:
      return false;
    default:
      return state;
  }
}

export function blipUrls(state = initialState.blipUrls, action) {
  switch (action.type) {
    case types.SET_BLIP_URL:
      return _.assign({}, state, {
        blipUrl: action.payload.url
      });
    case types.SET_BLIP_VIEW_DATA_URL:
      return _.assign({}, state, {
        viewDataLink: action.payload.url
      });
    case types.SET_FORGOT_PASSWORD_URL:
      return _.assign({}, state, {
        forgotPassword: action.payload.url
      });
    case types.SET_SIGNUP_URL:
      return _.assign({}, state, {
        signUp: action.payload.url
      });
    case types.SET_NEW_PATIENT_URL:
      return _.assign({}, state, {
        newPatient: action.payload.url
      });
    default:
      return state;
  }
}

export function electronUpdateManualChecked(state = initialState.electronUpdateManualChecked, action) {
  switch (action.type) {
    case types.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return true;
    case types.DISMISS_UPDATE_NOT_AVAILABLE:
      return initialState.electronUpdateManualChecked;
    default:
      return state;
  }
}

export function electronUpdateAvailableDismissed(state = initialState.electronUpdateAvailableDismissed, action) {
  switch (action.type) {
    case types.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return initialState.electronUpdateAvailableDismissed;
    case types.DISMISS_UPDATE_AVAILABLE:
      return true;
    default:
      return state;
  }
}

export function electronUpdateAvailable(state = initialState.electronUpdateAvailable, action) {
  switch (action.type) {
    case types.AUTO_UPDATE_CHECKING_FOR_UPDATES:
    case types.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
      return initialState.electronUpdateAvailable;
    case types.UPDATE_AVAILABLE:
      return true;
    case types.UPDATE_NOT_AVAILABLE:
      return false;
    default:
      return state;
  }
}

export function electronUpdateDownloaded(state = initialState.electronUpdateDownloaded, action) {
  switch (action.type) {
    case types.UPDATE_AVAILABLE:
      return initialState.electronUpdateDownloaded;
    case types.UPDATE_DOWNLOADED:
      return true;
    case types.AUTOUPDATE_ERROR:
      return false;
    default:
      return state;
  }
}

export function driverUpdateAvailable(state = initialState.driverUpdateAvailable, action) {
  switch (action.type) {
    case types.DRIVER_UPDATE_AVAILABLE:
      return action.payload;
    case types.DRIVER_UPDATE_NOT_AVAILABLE:
    case types.DRIVER_INSTALL:
      return false;
    default:
      return state;
  }
}

export function driverUpdateAvailableDismissed(state = initialState.driverUpdateAvailableDismissed, action) {
  switch (action.type) {
    case types.CHECKING_FOR_DRIVER_UPDATE:
      return false;
    case types.DISMISS_DRIVER_UPDATE_AVAILABLE:
      return true;
    default:
      return state;
  }
}

export function driverUpdateShellOpts(state = initialState.driverUpdateShellOpts, action) {
  switch (action.type) {
    case types.DRIVER_INSTALL_SHELL_OPTS:
      return action.payload;
    default:
      return state;
  }
}

export function driverUpdateComplete(state = initialState.driverUpdateComplete, action) {
  switch (action.type) {
    case types.DRIVER_INSTALL:
      return true;
    default:
      return state;
  }
}

export function showingDeviceTimePrompt(state = initialState.showingDeviceTimePrompt, action) {
  switch (action.type) {
    case types.DEVICE_TIME_INCORRECT:
      return { callback: action.payload.callback, cfg: action.payload.cfg, times: action.payload.times };
    case types.DISMISS_DEVICE_TIME_PROMPT:
      return false;
    default:
      return state;
  }
}

export function isTimezoneFocused(state = initialState.isTimezoneFocused, action) {
  switch (action.type) {
    case types.UPLOAD_CANCELLED:
      return true;
    case types.TIMEZONE_BLUR:
    case types.UPLOAD_REQUEST:
      return initialState.isTimezoneFocused;
    default:
      return state;
  }
}

export function showingAdHocPairingDialog(state = initialState.showingAdHocPairingDialog, action) {
  switch (action.type) {
    case types.AD_HOC_PAIRING_REQUEST:
      return { callback: action.payload.callback, cfg: action.payload.cfg };
    case types.AD_HOC_PAIRING_DISMISSED:
      return initialState.showingAdHocPairingDialog;
    default:
      return state;
  }
}

export const clinics = (state = initialState.clinics, action) => {
  switch (action.type) {
    case types.FETCH_PATIENTS_FOR_CLINIC_SUCCESS: {
      const patients = _.get(action.payload, 'patients', []);
      const clinicId = _.get(action.payload, 'clinicId', '');
      const count = _.get(action.payload, 'count', null);
      const newPatientSet = _.reduce(patients, (newSet, patient) => {
        newSet[patient.id] = patient;
        return newSet;
      }, {});
      return update(state, {
        [clinicId]: { $set: { ...state[clinicId], patients: newPatientSet, patientCount: count } },
      });
    }
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS:
    case types.UPDATE_CLINIC_PATIENT_SUCCESS: {
      const patient = _.get(action.payload, 'patient', '');
      const clinicId = _.get(action.payload, 'clinicId', '');
      const newClinics = _.cloneDeep(state);
      _.set(newClinics, [clinicId, 'patients', patient.id], patient);
      return newClinics;
    }
    case types.GET_CLINICS_FOR_CLINICIAN_SUCCESS: {
      const clinics = _.get(action.payload, 'clinics');
      const newClinics = _.reduce(
        clinics,
        (newSet, clinic) => {
          newSet[clinic.clinic.id] = {
            ...clinic.clinic,
            clinicians: { [clinic.clinician.id]: clinic.clinician },
          };
          return newSet;
        },
        {}
      );
      return _.merge({}, state, newClinics);
    }
    case types.ADD_TARGET_DEVICE: {
      const userId = _.get(action.payload, 'userId');
      const deviceKey = _.get(action.payload, 'deviceKey');
      const selectedClinicId = _.get(action.payload, 'selectedClinicId');
      if (!selectedClinicId) return state;
      return update(state, {
        [selectedClinicId]: {
          patients: {
            [userId]: {
              targetDevices: targetDevices => update(targetDevices || [], {$push: [deviceKey]} )
            }
          }
        }
      });
    }
    case types.REMOVE_TARGET_DEVICE: {
      const userId = _.get(action.payload, 'userId');
      const deviceKey = _.get(action.payload, 'deviceKey');
      const selectedClinicId = _.get(action.payload, 'selectedClinicId');
      if (!selectedClinicId) return state;
      return update(state, {
        [selectedClinicId]: {
          patients: {
            [userId]: {
              targetDevices: {
                $apply: (devices) => {
                  return _.filter(devices, (device) => {
                    return device !== deviceKey;
                  });
                },
              },
            },
          },
        },
      });
    }
    case types.LOGOUT_REQUEST:
      return initialState.clinics;
    default:
      return state;
  }
};

export const selectedClinicId = (state = initialState.selectedClinicId, action) => {
  switch(action.type) {
    case types.SELECT_CLINIC:
      return _.get(action.payload, 'clinicId', null);
    case types.LOGOUT_REQUEST:
      return null;
    default:
      return state;
  }
};

export const keycloakConfig = (state = initialState.keycloakConfig, action) => {
  switch (action.type) {
    case types.FETCH_INFO_SUCCESS: {
      let auth = _.get(action.payload, 'info.auth', { url: '', realm: '' });
      if (!_.isMatch(state, auth)) {
        return _.extend({}, state, { initialized: false }, auth);
      }
      return state;
    }
    case types.KEYCLOAK_READY:
      return _.extend({}, state, { initialized: true });
    case types.SET_KEYCLOAK_REGISTRATION_URL:
      return _.extend({}, state, { registrationUrl: action.payload.url });
    case types.KEYCLOAK_INSTANTIATED:
      return _.extend({}, state, { instantiated: true });
    default:
      return state;
  }
};
