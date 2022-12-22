import _ from 'lodash';
import update from 'immutability-helper';

import * as types from '../constants/actionTypes';
import actionWorkingMap from '../constants/actionWorkingMap';

import initialState from './initialState';
const { working: initialWorkingState } = initialState;

export default (state = initialWorkingState, action) => {
  let key;
  switch (action.type) {
    case types.ACKNOWLEDGE_NOTIFICATION:
      if (action.payload.acknowledgedNotification) {
        return update(state, {
          [action.payload.acknowledgedNotification]: {
            notification: { $set: null }
          }
        });
      } else {
        return initialWorkingState;
      }

    /**
     * Request handling
     *  - All working state objects have a similar structure and are updated
     *  in a consistent manner
     */
    case types.FETCH_ASSOCIATED_ACCOUNTS_REQUEST:
    case types.FETCH_PATIENT_REQUEST:
    case types.LOGIN_REQUEST:
    case types.LOGOUT_REQUEST:
    case types.FETCH_PATIENTS_FOR_CLINIC_REQUEST:
    case types.CREATE_CUSTODIAL_ACCOUNT_REQUEST:
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST:
    case types.UPDATE_CLINIC_PATIENT_REQUEST:
    case types.CHECKING_FOR_DRIVER_UPDATE:
    case types.VERSION_CHECK_REQUEST:
    case types.UPLOAD_REQUEST:
    case types.AUTO_UPDATE_CHECKING_FOR_UPDATES:
    case types.MANUAL_UPDATE_CHECKING_FOR_UPDATES:
    case types.GET_CLINICS_FOR_CLINICIAN_REQUEST:
    case types.INIT_APP_REQUEST:
    case types.UPDATE_PROFILE_REQUEST:
    case types.FETCH_INFO_REQUEST:
      key = actionWorkingMap(action.type);
      if (key) {
        if (_.includes([
          types.CREATE_CUSTODIAL_ACCOUNT_REQUEST,
          types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST,
          types.FETCH_PATIENTS_FOR_CLINIC_REQUEST,
        ], action.type)) {
          return update(state, {
            [key]: {
              $set: {
                inProgress: true,
                notification: null,
                completed: null, // For these types we don't persist the completed state
              }
            }
          });
        } else {
          return update(state, {
            [key]: {
              $set: {
                inProgress: true,
                notification: null,
                completed: state[key].completed,
              }
            }
          });
        }
      } else {
        return state;
      }

    /**
     * Success handling
     *  - All working state objects have a similar structure and are updated
     *  in a consistent manner
     */
    case types.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS:
    case types.FETCH_PATIENT_SUCCESS:
    case types.LOGIN_SUCCESS:
    case types.LOGOUT_SUCCESS:
    case types.FETCH_PATIENTS_FOR_CLINIC_SUCCESS:
    case types.CREATE_CUSTODIAL_ACCOUNT_SUCCESS:
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS:
    case types.UPDATE_CLINIC_PATIENT_SUCCESS:
    case types.GET_CLINICS_FOR_CLINICIAN_SUCCESS:
    case types.VERSION_CHECK_SUCCESS:
    case types.UPLOAD_SUCCESS:
    case types.UPDATE_AVAILABLE:
    case types.UPDATE_NOT_AVAILABLE:
    case types.DRIVER_UPDATE_AVAILABLE:
    case types.DRIVER_UPDATE_NOT_AVAILABLE:
    case types.GET_CLINICS_FOR_CLINICIAN_SUCCESS:
    case types.INIT_APP_SUCCESS:
    case types.UPDATE_PROFILE_SUCCESS:
    case types.FETCH_INFO_SUCCESS:
      key = actionWorkingMap(action.type);
      if (key) {
        if (action.type === types.LOGOUT_SUCCESS) {
          return update(initialWorkingState, {
            [key]: {
              $set: {
                inProgress: false,
                notification: _.get(action, ['payload', 'notification'], null),
                completed: true,
              }
            }
          });
        } else {
          return update(state, {
            [key]: {
              $set: {
                inProgress: false,
                notification: _.get(action, ['payload', 'notification'], null),
                completed: true,
              }
            }
          });
        }
      }
      else {
        return state;
      }

    /**
     * Failure handling
     *  - All working state objects have a similar structure and are updated
     *  in a consistent manner
     */
    case types.FETCH_ASSOCIATED_ACCOUNTS_FAILURE:
    case types.FETCH_PATIENT_FAILURE:
    case types.LOGIN_FAILURE:
    case types.FETCH_PATIENTS_FOR_CLINIC_FAILURE:
    case types.CREATE_CUSTODIAL_ACCOUNT_FAILURE:
    case types.CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE:
    case types.UPDATE_CLINIC_PATIENT_FAILURE:
    case types.GET_CLINICS_FOR_CLINICIAN_FAILURE:
    case types.VERSION_CHECK_FAILURE:
    case types.READ_FILE_ABORTED:
    case types.READ_FILE_FAILURE:
    case types.UPLOAD_FAILURE:
    case types.UPLOAD_CANCELLED:
    case types.AUTOUPDATE_ERROR:
    case types.GET_CLINICS_FOR_CLINICIAN_FAILURE:
    case types.INIT_APP_FAILURE:
    case types.UPDATE_PROFILE_FAILURE:
    case types.FETCH_INFO_FAILURE:
      key = actionWorkingMap(action.type);
      if (key) {
        return update(state, {
          [key]: {
            $set: {
              inProgress: false,
              notification: {
                type: 'error',
                message: _.get(action, ['error', 'message'], _.get(action, ['payload', 'message'], null)),
              },
              completed: false,
            }
          }
        });
      } else {
        return state;
      }

    case types.SELECT_CLINIC:
      const newState = _.cloneDeep(state);
      _.forEach([
        'fetchingPatientsForClinic',
      ], key => _.set(newState, key, {
        inProgress: false,
        notification: null,
        completed: null,
      }));
      return newState;

    default:
      return state;
  }
};
