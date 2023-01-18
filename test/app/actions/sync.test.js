/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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


import { isFSA } from 'flux-standard-action';
import { expect } from 'chai';

import * as actionSources from '../../../app/constants/actionSources';
import * as actionTypes from '../../../app/constants/actionTypes';
import * as metrics from '../../../app/constants/metrics';

import * as sync from '../../../app/actions/sync';
import { __Rewire__, __ResetDependency__ } from '../../../app/actions/sync';
import {
  getCreateCustodialAccountErrorMessage,
  getUpdateProfileErrorMessage,
  UnsupportedError,
} from '../../../app/utils/errors';
import ErrorMessages from '../../../app/constants/errorMessages';

describe('Synchronous Actions', () => {
  describe('addTargetDevice', () => {
    const DEVICE = 'a_pump', ID = 'a1b2c3', CLINICID='clinic123';
    test('should be an FSA', () => {
      let action = sync.addTargetDevice(ID, DEVICE);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to add a device to a user\'s target devices', () => {
      const expectedAction = {
        type: actionTypes.ADD_TARGET_DEVICE,
        payload: {userId: ID, deviceKey: DEVICE, selectedClinicId: undefined},
        meta: {source: actionSources[actionTypes.ADD_TARGET_DEVICE]}
      };
      expect(sync.addTargetDevice(ID, DEVICE)).to.deep.equal(expectedAction);
    });

    test('should create an action to add a device to a user\'s target devices with clinicId', () => {
      const expectedAction = {
        type: actionTypes.ADD_TARGET_DEVICE,
        payload: {userId: ID, deviceKey: DEVICE, selectedClinicId: CLINICID},
        meta: {source: actionSources[actionTypes.ADD_TARGET_DEVICE]}
      };
      expect(sync.addTargetDevice(ID, DEVICE, CLINICID)).to.deep.equal(expectedAction);
    });
  });

  describe('clickGoToBlip', () => {
    test('should be an FSA', () => {
      let action = sync.clickGoToBlip();

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to report a user\'s clicking of the \'Go to Blip\' button', () => {
      const expectedAction = {
        type: actionTypes.CLICK_GO_TO_BLIP,
        meta: {
          source: actionSources[actionTypes.CLICK_GO_TO_BLIP],
          metric: {eventName: metrics.CLICK_GO_TO_BLIP}
        }
      };

      expect(sync.clickGoToBlip()).to.deep.equal(expectedAction);
    });
  });

  describe('clinicAddMrn', () => {
    test('should be an FSA', () => {
      let action = sync.clinicAddMrn();

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to report a clinic adding an MRN to a patient', () => {
      const expectedAction = {
        type: actionTypes.CLINIC_ADD_MRN,
        meta: {
          source: actionSources[actionTypes.CLINIC_ADD_MRN],
          metric: {eventName: metrics.CLINIC_ADD_MRN}
        }
      };

      expect(sync.clinicAddMrn()).to.deep.equal(expectedAction);
    });
  });

  describe('clinicAddEmail', () => {
    test('should be an FSA', () => {
      let action = sync.clinicAddEmail();

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to report a clinic adding an email to a patient', () => {
      const expectedAction = {
        type: actionTypes.CLINIC_ADD_EMAIL,
        meta: {
          source: actionSources[actionTypes.CLINIC_ADD_EMAIL],
          metric: {eventName: metrics.CLINIC_ADD_EMAIL}
        }
      };

      expect(sync.clinicAddEmail()).to.deep.equal(expectedAction);
    });
  });

  describe('clinicAddDevice', () => {
    test('should be an FSA', () => {
      let action = sync.clinicAddDevice();

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to report a clinic adding a device', () => {
      const expectedAction = {
        type: actionTypes.CLINIC_DEVICE_STORED,
        meta: {
          source: actionSources[actionTypes.CLINIC_DEVICE_STORED],
          metric: {eventName: metrics.CLINIC_DEVICE_STORED + ' - ' + 'device'}
        }
      };

      expect(sync.clinicAddDevice('device')).to.deep.equal(expectedAction);
    });
  });

  describe('clinicInvalidDate', () => {
    test('should be an FSA', () => {
      let action = sync.clinicInvalidDate({year:'error'});

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to report a clinic setting an invalid date', () => {
      const expectedAction = {
        type: actionTypes.CLINIC_ADD_INVALID_DATE,
        meta: {
          source: actionSources[actionTypes.CLINIC_ADD_INVALID_DATE],
          metric: {eventName: metrics.CLINIC_ADD_INVALID_DATE}
        }
      };

      expect(sync.clinicInvalidDate({year:'error'})).to.deep.equal(expectedAction);
    });

    test('should not creat an action to report no error', () => {
      expect(sync.clinicInvalidDate()).to.be.undefined;
    });
  });

  describe('hideUnavailableDevices', () => {
    const OS = 'test';
    test('should be an FSA', () => {
      let action = sync.hideUnavailableDevices(OS);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to hide devices unavailable on given operating system', () => {
      const expectedAction = {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: OS},
        meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
      };
      expect(sync.hideUnavailableDevices(OS)).to.deep.equal(expectedAction);
    });
  });

  describe('removeTargetDevice', () => {
    const DEVICE = 'a_pump', ID = 'a1b2c3', CLINICID='clinic123';
    test('should be an FSA', () => {
      let action = sync.removeTargetDevice(ID, DEVICE);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to remove a device from a user\'s target devices', () => {
      const expectedAction = {
        type: actionTypes.REMOVE_TARGET_DEVICE,
        payload: {userId: ID, deviceKey: DEVICE, selectedClinicId: undefined},
        meta: {source: actionSources[actionTypes.REMOVE_TARGET_DEVICE]}
      };
      expect(sync.removeTargetDevice(ID, DEVICE)).to.deep.equal(expectedAction);
    });

    test('should create an action to remove a device from a user\'s target devices with clinicId', () => {
      const expectedAction = {
        type: actionTypes.REMOVE_TARGET_DEVICE,
        payload: {userId: ID, deviceKey: DEVICE, selectedClinicId: CLINICID},
        meta: {source: actionSources[actionTypes.REMOVE_TARGET_DEVICE]}
      };
      expect(sync.removeTargetDevice(ID, DEVICE, CLINICID)).to.deep.equal(expectedAction);
    });
  });

  describe('resetUpload', () => {
    const userId = 'a1b2c3', deviceKey = 'a_pump';
    test('should be an FSA', () => {
      let action = sync.resetUpload(userId, deviceKey);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to reset an upload after failure or success', () => {
      const expectedAction = {
        type: actionTypes.RESET_UPLOAD,
        payload: { userId, deviceKey },
        meta: {source: actionSources[actionTypes.RESET_UPLOAD]}
      };
      expect(sync.resetUpload(userId, deviceKey)).to.deep.equal(expectedAction);
    });
  });

  describe('setBlipViewDataUrl', () => {
    const url = 'http://acme-blip.com/patients/a1b2c3/data';
    test('should be an FSA', () => {
      let action = sync.setBlipViewDataUrl(url);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action set the url for viewing data in blip (wrt current uploadTargetUser)', () => {
      const expectedAction = {
        type: actionTypes.SET_BLIP_VIEW_DATA_URL,
        payload: { url },
        meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
      };

      expect(sync.setBlipViewDataUrl(url)).to.deep.equal(expectedAction);
    });
  });

  describe('setForgotPasswordUrl', () => {
    const URL = 'http://www.acme.com/forgot-password';
    test('should be an FSA', () => {
      let action = sync.setForgotPasswordUrl(URL);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set the forgot password url', () => {
      const expectedAction = {
        type: actionTypes.SET_FORGOT_PASSWORD_URL,
        payload: {url: URL},
        meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
      };
      expect(sync.setForgotPasswordUrl(URL)).to.deep.equal(expectedAction);
    });
  });

  describe('setSignUpUrl', () => {
    const URL = 'http://www.acme.com/sign-up';
    test('should be an FSA', () => {
      let action = sync.setSignUpUrl(URL);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set the sign-up url', () => {
      const expectedAction = {
        type: actionTypes.SET_SIGNUP_URL,
        payload: {url: URL},
        meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
      };
      expect(sync.setSignUpUrl(URL)).to.deep.equal(expectedAction);
    });
  });

  describe('setNewPatientUrl', () => {
    const URL = 'http://www.acme.com/patients/new';
    test('should be an FSA', () => {
      let action = sync.setNewPatientUrl(URL);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set the new patient url', () => {
      const expectedAction = {
        type: actionTypes.SET_NEW_PATIENT_URL,
        payload: {url: URL},
        meta: {source: actionSources[actionTypes.SET_NEW_PATIENT_URL]}
      };
      expect(sync.setNewPatientUrl(URL)).to.deep.equal(expectedAction);
    });
  });

  describe('setTargetTimezone', () => {
    const TIMEZONE = 'Europe/Budapest', ID = 'a1b2c3';
    test('should be an FSA', () => {
      let action = sync.setTargetTimezone(ID, TIMEZONE);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set the target timezone for a user', () => {
      const expectedAction = {
        type: actionTypes.SET_TARGET_TIMEZONE,
        payload: {userId: ID, timezoneName: TIMEZONE},
        meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]}
      };
      expect(sync.setTargetTimezone(ID, TIMEZONE)).to.deep.equal(expectedAction);
    });
  });

  describe('setUploads', () => {
    const devicesByUser = {
      a1b2c3: {a_pump: {}, a_cgm: {}},
      d4e5f6: {another_pump: {}}
    };
    test('should be an FSA', () => {
      let action = sync.setUploads(devicesByUser);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set up the potential uploads for each user reflecting target devices selected', () => {
      const expectedAction = {
        type: actionTypes.SET_UPLOADS,
        payload: { devicesByUser },
        meta: {source: actionSources[actionTypes.SET_UPLOADS]}
      };
      expect(sync.setUploads(devicesByUser)).to.deep.equal(expectedAction);
    });
  });

  describe('setUploadTargetUser', () => {
    const ID = 'a1b2c3';
    test('should be an FSA', () => {
      let action = sync.setUploadTargetUser(ID);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set the target user for data upload', () => {
      const expectedAction = {
        type: actionTypes.SET_UPLOAD_TARGET_USER,
        payload: {userId: ID},
        meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
      };
      expect(sync.setUploadTargetUser(ID)).to.deep.equal(expectedAction);
    });
  });

  describe('toggleDropdown', () => {
    const DROPDOWN_PREVIOUS_STATE = true;
    test('should be an FSA', () => {
      let action = sync.toggleDropdown(DROPDOWN_PREVIOUS_STATE);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to toggle the dropdown menu', () => {
      const expectedAction = {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false},
        meta: {source: actionSources[actionTypes.TOGGLE_DROPDOWN]}
      };
      expect(sync.toggleDropdown(DROPDOWN_PREVIOUS_STATE)).to.deep.equal(expectedAction);
    });

    test('should accept a second parameter to override the default action source', () => {
      const expectedAction = {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false},
        meta: {source: actionSources.UNDER_THE_HOOD}
      };
      expect(sync.toggleDropdown(DROPDOWN_PREVIOUS_STATE, actionSources.UNDER_THE_HOOD)).to.deep.equal(expectedAction);
    });
  });

  describe('toggleErrorDetails', () => {
    const DETAILS_PREVIOUS_STATE = true;
    const userId = 'a1b2c3', deviceKey = 'a_cgm';
    test('should be an FSA', () => {
      let action = sync.toggleErrorDetails(userId, deviceKey, DETAILS_PREVIOUS_STATE);

      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to toggle error details for an upload', () => {
      const expectedAction = {
        type: actionTypes.TOGGLE_ERROR_DETAILS,
        payload: {isVisible: false, userId, deviceKey },
        meta: {source: actionSources[actionTypes.TOGGLE_ERROR_DETAILS]}
      };
      expect(sync.toggleErrorDetails(userId, deviceKey, DETAILS_PREVIOUS_STATE)).to.deep.equal(expectedAction);
    });

    test('should toggle on error details if previous state is undefined', () => {
      const expectedAction = {
        type: actionTypes.TOGGLE_ERROR_DETAILS,
        payload: {isVisible: true, userId, deviceKey },
        meta: {source: actionSources[actionTypes.TOGGLE_ERROR_DETAILS]}
      };
      expect(sync.toggleErrorDetails(userId, deviceKey, undefined)).to.deep.equal(expectedAction);
    });
  });

  describe('for doAppInit', () => {
    describe('initializeAppRequest', () => {
      test('should be an FSA', () => {
        let action = sync.initializeAppRequest();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record the start of app initialization',  () => {
        const expectedAction = {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        };
        expect(sync.initializeAppRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('initializeAppSuccess', () => {
      test('should be an FSA', () => {
        let action = sync.initializeAppSuccess();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record the successful completion of app initialization',  () => {
        const expectedAction = {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        };
        expect(sync.initializeAppSuccess()).to.deep.equal(expectedAction);
      });
    });

    describe('initializeAppFailure', () => {
      const err = new Error();
      test('should be an FSA', () => {
        let action = sync.initializeAppFailure(err);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record early exit from app initialization due to error',  () => {
        const expectedAction = {
          type: actionTypes.INIT_APP_FAILURE,
          error: true,
          payload: new Error(ErrorMessages.E_INIT),
          meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
        };
        const action = sync.initializeAppFailure(err);
        expect(action.payload).to.deep.include({message:ErrorMessages.E_INIT});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
      });
    });

    describe('setUserInfoFromToken', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const user = {userid: 'abc123'};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      test('should be an FSA', () => {
        let action = sync.setUserInfoFromToken({ user, profile, memberships });
        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to set the logged-in user (plus user\'s profile, careteam memberships)',  () => {
        const expectedAction = {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: { user, profile, memberships },
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        };
        expect(sync.setUserInfoFromToken({ user, profile, memberships })).to.deep.equal(expectedAction);
      });
    });
  });

  describe('for doLogin', () => {
    describe('loginRequest', () => {
      test('should be an FSA', () => {
        let action = sync.loginRequest();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record the start of user login', () => {
        const expectedAction = {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        };
        expect(sync.loginRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('loginSuccess', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const user = {userid: 'abc123'};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      test('should be an FSA', () => {
        expect(isFSA(sync.loginSuccess({ user, profile, memberships }))).to.be.true;
      });

      test('should create an action to set the logged-in user (plus user\'s profile, careteam memberships)',  () => {
        const expectedAction = {
          type: actionTypes.LOGIN_SUCCESS,
          payload: { user, profile, memberships },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: {eventName: metrics.LOGIN_SUCCESS}
          }
        };
        expect(sync.loginSuccess({ user, profile, memberships })).to.deep.equal(expectedAction);
      });
    });

    describe('loginFailure', () => {
      const err = 'Login error!';
      test('should be an FSA', () => {
        let action = sync.loginFailure(err);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to report a login error', () => {
        __Rewire__('getLoginErrorMessage', () => err);
        const expectedAction = {
          type: actionTypes.LOGIN_FAILURE,
          error: true,
          payload: new Error(err),
          meta: {source: actionSources[actionTypes.LOGIN_FAILURE]}
        };
        const action = sync.loginFailure(err);
        expect(action.payload).to.deep.include({message:err});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
        __ResetDependency__('getLoginErrorMessage');
      });
    });
  });

  describe('for doLogout', () => {
    describe('logoutRequest', () => {
      test('should be an FSA', () => {
        let action = sync.logoutRequest();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to request logout and clear logged-in user related state',  () => {
        const expectedAction = {
          type: actionTypes.LOGOUT_REQUEST,
          meta: {
            source: actionSources[actionTypes.LOGOUT_REQUEST],
            metric: {eventName: metrics.LOGOUT_REQUEST}
          }
        };
        expect(sync.logoutRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('logoutSuccess', () => {
      test('should be an FSA', () => {
        let action = sync.logoutSuccess();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to announce the success of logout', () => {
        const expectedAction = {
          type: actionTypes.LOGOUT_SUCCESS,
          meta: {source: actionSources[actionTypes.LOGOUT_SUCCESS]}
        };
        expect(sync.logoutSuccess()).to.deep.equal(expectedAction);
      });
    });

    describe('logoutFailure', () => {
      const err = 'Logout error!';
      test('should be an FSA', () => {
        let action = sync.logoutFailure(err);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to report a logout error', () => {
        __Rewire__('getLogoutErrorMessage', () => err);
        const expectedAction = {
          type: actionTypes.LOGOUT_FAILURE,
          error: true,
          payload: new Error(err),
          meta: {source: actionSources[actionTypes.LOGOUT_FAILURE]}
        };
        const action = sync.logoutFailure(err);
        expect(action.payload).to.deep.include({message:err});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
        __ResetDependency__('getLoginErrorMessage');
      });
    });
  });

  describe('for doUpload', () => {
    describe('uploadAborted', () => {
      test('should be an FSA', () => {
        let action = sync.uploadAborted();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action reporting an aborted upload (b/c another upload in progress)',  () => {
        const expectedAction = {
          type: actionTypes.UPLOAD_ABORTED,
          error: true,
          payload: new Error(ErrorMessages.E_UPLOAD_IN_PROGRESS),
          meta: {source: actionSources[actionTypes.UPLOAD_ABORTED]}
        };
        const action = sync.uploadAborted();
        expect(action.payload).to.deep.include({message:ErrorMessages.E_UPLOAD_IN_PROGRESS});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
      });
    });

    describe('uploadRequest', () => {
      const userId = 'a1b2c3';
      const device = {
        key: 'a_pump',
        name: 'Acme Pump',
        source: {type: 'device', driverId: 'AcmePump'},
        enabled: {mac: true, win: true}
      };
      test('should be an FSA', () => {
        let action = sync.uploadRequest(userId, device);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record the start of an upload', () => {
        const time = '2016-01-01T12:05:00.123Z';
        const expectedAction = {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey: device.key, utc: time},
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {type: device.source.type, source: device.source.driverId}
            }
          }
        };

        expect(sync.uploadRequest(userId, device, time)).to.deep.equal(expectedAction);
      });

      test('should create appropriate metric properties for 600 series upload limits',  () => {
        const time = '2016-01-01T12:05:00.123Z';
        __Rewire__('uploadDataPeriod', { periodMedtronic600: 1 });
        device.source.driverId = 'Medtronic600';
        const expectedAction = {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey: device.key, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {
                type: device.source.type,
                source: device.source.driverId,
                limit: 'all data'
              }
            }
          }
        };

        expect(sync.uploadRequest(userId, device, time)).to.deep.equal(expectedAction);
        __ResetDependency__('uploadDataPeriod');
      });
    });

    describe('uploadProgress', () => {
      const step = 'READ', percentage = 50, isFirstUpload = true;
      test('should be an FSA', () => {
        let action = sync.uploadProgress(step, percentage);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to update the step and percentage complete for the upload in progress',  () => {
        const expectedAction = {
          type: actionTypes.UPLOAD_PROGRESS,
          payload: { step, percentage, isFirstUpload },
          meta: {source: actionSources[actionTypes.UPLOAD_PROGRESS]}
        };

        expect(sync.uploadProgress(step, percentage, isFirstUpload)).to.deep.equal(expectedAction);
      });
    });

    describe('uploadSuccess', () => {
      const time = '2016-01-01T12:05:00.123Z';
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const device = {
        key: deviceKey,
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const upload = {
        history: [{start: time}]
      };
      const data = {
        post_records: [1,2,3,4,5],
        deviceModel: 'acme'
      };
      test('should be an FSA', () => {
        let action = sync.uploadSuccess(userId, device, upload, data);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record a successful upload', () => {
        const expectedAction = {
          type: actionTypes.UPLOAD_SUCCESS,
          payload: { userId, deviceKey: device.key, data, utc: time},
          meta: {
            source: actionSources[actionTypes.UPLOAD_SUCCESS],
            metric: {
              eventName: `${metrics.UPLOAD_SUCCESS}`,
              properties: {
                type: device.source.type,
                deviceModel: 'acme',
                source: device.source.driverId,
                started: time,
                finished: time,
                processed: data.post_records.length
              }
            }
          }
        };
        expect(sync.uploadSuccess(userId, device, upload, data, time)).to.deep.equal(expectedAction);
      });

      test('should create an action to record a successful 600 series upload w/ limit',  () => {
        const time = '2016-01-01T12:05:00.123Z';
        __Rewire__('uploadDataPeriod', { periodMedtronic600: 2 });
        device.source.driverId = 'Medtronic600';
        const expectedAction = {
          type: actionTypes.UPLOAD_SUCCESS,
          payload: { userId, deviceKey: device.key, data, utc: time},
          meta: {
            source: actionSources[actionTypes.UPLOAD_SUCCESS],
            metric: {
              eventName: `${metrics.UPLOAD_SUCCESS}`,
              properties: {
                type: device.source.type,
                deviceModel: 'acme',
                source: device.source.driverId,
                started: time,
                finished: time,
                processed: data.post_records.length,
                limit: 'new data'
              }
            }
          }
        };

        expect(sync.uploadSuccess(userId, device, upload, data, time)).to.deep.equal(expectedAction);
        __ResetDependency__('uploadDataPeriod');
      });
    });

    describe('uploadFailure', () => {
      const origError = new Error('I\'m an upload error!');
      const errProps = {
        utc: '2016-01-01T12:05:00.123Z',
        code: 'RED'
      };
      let resError = new Error('I\'m an upload error!');
      resError.code = errProps.code;
      resError.utc = errProps.utc;
      resError.debug = `UTC Time: ${errProps.utc} | Code: ${errProps.code}`;
      const device = {
        source: {type: 'device', driverId: 'AcmePump'}
      };
      test('should be an FSA', () => {
        let action = sync.uploadFailure(origError, errProps, device);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to report an upload failure', () => {
        const expectedAction = {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: resError,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: `${metrics.UPLOAD_FAILURE}`,
              properties: {
                type: device.source.type,
                source: device.source.driverId,
                error: resError
              }
            }
          }
        };
        const action = sync.uploadFailure(origError, errProps, device);
        expect(action.payload).to.deep.include({
          message: resError.message,
          code: resError.code,
          utc: resError.utc,
          debug: resError.debug
        });
        expectedAction.payload = action.payload;
        expectedAction.meta.metric.properties.error = action.payload;
        expect(action).to.deep.equal(expectedAction);
        expect(sync.uploadFailure(origError, errProps, device)).to.deep.equal(expectedAction);
      });

      test('should create an action to report an upload failure with limit for 600 series',  () => {
        __Rewire__('uploadDataPeriod', { periodMedtronic600: 3 });
        device.source.driverId = 'Medtronic600';
        const expectedAction = {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: resError,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: `${metrics.UPLOAD_FAILURE}`,
              properties: {
                type: device.source.type,
                source: device.source.driverId,
                error: resError,
                limit: '4 weeks'
              }
            }
          }
        };
        const action = sync.uploadFailure(origError, errProps, device);
        expect(action.payload).to.deep.include({
          message: resError.message,
          code: resError.code,
          utc: resError.utc,
          debug: resError.debug
        });
        expectedAction.payload = action.payload;
        expectedAction.meta.metric.properties.error = action.payload;
        expect(action).to.deep.equal(expectedAction);
        expect(sync.uploadFailure(origError, errProps, device)).to.deep.equal(expectedAction);
        __ResetDependency__('uploadDataPeriod');
      });
    });

    describe('uploadCancelled', () => {
      const errProps = {
        utc: '2016-01-01T12:05:00.123Z',
      };
      const device = {
        source: {type: 'device', driverId: 'AcmePump'}
      };
      test('should be an FSA', () => {
        let action = sync.uploadCancelled();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to report an upload cancellation', () => {
        const expectedAction = {
          type: actionTypes.UPLOAD_CANCELLED,
          payload: { utc: errProps.utc },
          meta: {
            source: actionSources[actionTypes.UPLOAD_CANCELLED]
          }
        };
        const action = sync.uploadCancelled(errProps.utc);
        expect(action).to.deep.equal(expectedAction);
      });
    });

    describe('deviceDetectRequest', () => {
      test('should be an FSA', () => {
        let action = sync.deviceDetectRequest();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action record an attempt to detect a device', () => {
        const expectedAction = {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        };

        expect(sync.deviceDetectRequest()).to.deep.equal(expectedAction);
      });
    });
  });

  describe('for readFile', () => {
    describe('choosingFile', () => {
      const userId = 'abc123', deviceKey = 'a_pump';
      test('should be an FSA', () => {
        let action = sync.choosingFile(userId, deviceKey);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record file selection for a block-mode device',  () => {
        const expectedAction = {
          type: actionTypes.CHOOSING_FILE,
          payload: { userId, deviceKey },
          meta: {source: actionSources[actionTypes.CHOOSING_FILE]}
        };

        expect(sync.choosingFile(userId, deviceKey)).to.deep.equal(expectedAction);
      });
    });

    describe('readFileAborted', () => {
      let err = new Error('Wrong file extension!');
      test('should be an FSA', () => {
        let action = sync.readFileAborted(err);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to report user error in choosing a file with the wrong extension',  () => {
        const expectedAction = {
          type: actionTypes.READ_FILE_ABORTED,
          error: true,
          payload: err,
          meta: {source: actionSources[actionTypes.READ_FILE_ABORTED]}
        };
        const action = sync.readFileAborted(err);
        expect(action.payload).to.deep.include({message:err.message});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
      });
    });

    describe('readFileRequest', () => {
      const userId = 'abc123', deviceKey = 'a_pump';
      const filename = 'my-data.ext';
      test('should be an FSA', () => {
        let action = sync.readFileRequest(userId, deviceKey, filename);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record request to read a chosen file', () => {
        const expectedAction = {
          type: actionTypes.READ_FILE_REQUEST,
          payload: { userId, deviceKey, filename },
          meta: {source: actionSources[actionTypes.READ_FILE_REQUEST]}
        };

        expect(sync.readFileRequest(userId, deviceKey, filename)).to.deep.equal(expectedAction);
      });
    });

    describe('readFileSuccess', () => {
      const userId = 'abc123', deviceKey = 'a_pump';
      const filedata = [1,2,3,4,5];
      test('should be an FSA', () => {
        let action = sync.readFileSuccess(userId, deviceKey, filedata);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record data of successfully read file',  () => {
        const expectedAction = {
          type: actionTypes.READ_FILE_SUCCESS,
          payload: { userId, deviceKey, filedata },
          meta: {source: actionSources[actionTypes.READ_FILE_SUCCESS]}
        };

        expect(sync.readFileSuccess(userId, deviceKey, filedata)).to.deep.equal(expectedAction);
      });
    });

    describe('readFileFailure', () => {
      let err = new Error('Error reading file!');
      test('should be an FSA', () => {
        let action = sync.readFileFailure(err);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to report error reading chosen file', () => {
        const expectedAction = {
          type: actionTypes.READ_FILE_FAILURE,
          error: true,
          payload: err,
          meta: {source: actionSources[actionTypes.READ_FILE_FAILURE]}
        };
        const action = sync.readFileFailure(err);
        expect(action.payload).to.deep.include({message:err.message});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
      });
    });
  });

  describe('for doVersionCheck', () => {
    describe('versionCheckRequest', () => {
      test('should be an FSA', () => {
        let action = sync.versionCheckRequest();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record the start of the uploader supported version check',  () => {
        const expectedAction = {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        };

        expect(sync.versionCheckRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('versionCheckSuccess', () => {
      test('should be an FSA', () => {
        let action = sync.versionCheckSuccess();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to mark the current uploader\'s version as supported',  () => {
        const expectedAction = {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        };

        expect(sync.versionCheckSuccess()).to.deep.equal(expectedAction);
      });
    });

    describe('versionCheckFailure', () => {
      const currentVersion = '0.99.0', requiredVersion = '0.100.0';
      test('should be an FSA [API response err]', () => {
        let action = sync.versionCheckFailure(new Error('API error!'));

        expect(isFSA(action)).to.be.true;
      });

      test('should be an FSA [out-of-date version]', () => {
        let action = sync.versionCheckFailure(null, currentVersion, requiredVersion);

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to record an unsuccessful attempt to check the uploader\'s version',  () => {
        const err = new Error('API error');
        const expectedAction = {
          type: actionTypes.VERSION_CHECK_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.VERSION_CHECK_FAILURE],
            metric: {
              eventName: metrics.UNSUPPORTED_SCREEN_DISPLAYED
            }
          }
        };
        const action = sync.versionCheckFailure(err);
        expect(action.payload).to.deep.include({message:err.message});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
      });

      test('should create an action to mark the current uploader\'s version as unsupported',  () => {
        const err = new UnsupportedError(currentVersion, requiredVersion);
        const expectedAction = {
          type: actionTypes.VERSION_CHECK_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.VERSION_CHECK_FAILURE],
            metric: {
              eventName: metrics.VERSION_CHECK_FAILURE_OUTDATED,
              properties: { requiredVersion }
            }
          }
        };
        const action = sync.versionCheckFailure(null, currentVersion, requiredVersion);
        expect(action.payload).to.deep.include({message:err.message});
        expectedAction.payload = action.payload;
        expect(action).to.deep.equal(expectedAction);
      });
    });
  });

  describe('for retrieveTargetsFromStorage', () => {

    describe('retrieveUsersTargetsFromStorage', () => {
      test('should be an FSA', () => {
        let action = sync.retrieveUsersTargetsFromStorage();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to announce the side effet of storing users\' targets locally',  () => {
        const expectedAction = {
          type: actionTypes.RETRIEVING_USERS_TARGETS,
          meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
        };
        expect(sync.retrieveUsersTargetsFromStorage()).to.deep.equal(expectedAction);
      });
    });

    describe('setUsersTargets', () => {
      // NB: this is not what this object actually looks like
      // actual shape is irrelevant to testing action creators
      const targets = {
        a1b2c3: ['foo', 'bar'],
        d4e5f6: ['baz']
      };
      test('should be an FSA', () => {
        let action = sync.setUsersTargets();

        expect(isFSA(action)).to.be.true;
      });

      test('should create an action to set the users\' target devices', () => {
        const expectedAction = {
          type: actionTypes.SET_USERS_TARGETS,
          payload: { targets },
          meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
        };
        expect(sync.setUsersTargets(targets)).to.deep.equal(expectedAction);
      });
    });
  });

  describe('autoCheckingForUpdates', () => {
    test('should be an FSA', () => {
      let action = sync.autoCheckingForUpdates();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate an automatic update check', () => {
      const expectedAction = {
        type: actionTypes.AUTO_UPDATE_CHECKING_FOR_UPDATES,
        meta: {source: actionSources[actionTypes.AUTO_UPDATE_CHECKING_FOR_UPDATES]}
      };
      expect(sync.autoCheckingForUpdates()).to.deep.equal(expectedAction);
    });
  });

  describe('manualCheckingForUpdates', () => {
    test('should be an FSA', () => {
      let action = sync.manualCheckingForUpdates();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate a manual update check', () => {
      const expectedAction = {
        type: actionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES,
        meta: {source: actionSources[actionTypes.MANUAL_UPDATE_CHECKING_FOR_UPDATES]}
      };
      expect(sync.manualCheckingForUpdates()).to.deep.equal(expectedAction);
    });
  });

  describe('updateAvailable', () => {
    const updateInfo = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.updateAvailable(updateInfo);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate an update being available', () => {
      const expectedAction = {
        type: actionTypes.UPDATE_AVAILABLE,
        payload: { info: updateInfo },
        meta: {source: actionSources[actionTypes.UPDATE_AVAILABLE]}
      };
      expect(sync.updateAvailable(updateInfo)).to.deep.equal(expectedAction);
    });
  });

  describe('updateNotAvailable', () => {
    const updateInfo = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.updateNotAvailable(updateInfo);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate no update available', () => {
      const expectedAction = {
        type: actionTypes.UPDATE_NOT_AVAILABLE,
        payload: { info: updateInfo },
        meta: {source: actionSources[actionTypes.UPDATE_NOT_AVAILABLE]}
      };
      expect(sync.updateNotAvailable(updateInfo)).to.deep.equal(expectedAction);
    });
  });

  describe('autoUpdateError', () => {
    const updateInfo = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.autoUpdateError(updateInfo);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate an error checking for update', () => {
      const expectedAction = {
        type: actionTypes.AUTOUPDATE_ERROR,
        payload: { error: updateInfo },
        meta: {source: actionSources[actionTypes.AUTOUPDATE_ERROR]}
      };
      expect(sync.autoUpdateError(updateInfo)).to.deep.equal(expectedAction);
    });
  });

  describe('updateDownloaded', () => {
    const updateInfo = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.updateDownloaded(updateInfo);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate an update finished downloading', () => {
      const expectedAction = {
        type: actionTypes.UPDATE_DOWNLOADED,
        payload: { info: updateInfo },
        meta: {source: actionSources[actionTypes.UPDATE_DOWNLOADED]}
      };
      expect(sync.updateDownloaded(updateInfo)).to.deep.equal(expectedAction);
    });
  });

  describe('dismissUpdateAvailable', () => {
    test('should be an FSA', () => {
      let action = sync.dismissUpdateAvailable();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate user dismissing update available modal', () => {
      const expectedAction = {
        type: actionTypes.DISMISS_UPDATE_AVAILABLE,
        meta: {source: actionSources[actionTypes.DISMISS_UPDATE_AVAILABLE]}
      };
      expect(sync.dismissUpdateAvailable()).to.deep.equal(expectedAction);
    });
  });

  describe('dismissUpdateNotAvailable', () => {
    test('should be an FSA', () => {
      let action = sync.dismissUpdateNotAvailable();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate user dismissing update unavailable modal', () => {
      const expectedAction = {
        type: actionTypes.DISMISS_UPDATE_NOT_AVAILABLE,
        meta: {source: actionSources[actionTypes.DISMISS_UPDATE_NOT_AVAILABLE]}
      };
      expect(sync.dismissUpdateNotAvailable()).to.deep.equal(expectedAction);
    });
  });

  describe('checkingForDriverUpdate', () => {
    test('should be an FSA', () => {
      let action = sync.checkingForDriverUpdate();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate a driver update check', () => {
      const expectedAction = {
        type: actionTypes.CHECKING_FOR_DRIVER_UPDATE,
        meta: {source: actionSources[actionTypes.CHECKING_FOR_DRIVER_UPDATE]}
      };
      expect(sync.checkingForDriverUpdate()).to.deep.equal(expectedAction);
    });
  });

  describe('driverUpdateAvailable', () => {
    const current = '1';
    const available = '2';
    test('should be an FSA', () => {
      let action = sync.driverUpdateAvailable(current, available);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate a driver update being available', () => {
      const expectedAction = {
        type: actionTypes.DRIVER_UPDATE_AVAILABLE,
        payload: { current, available },
        meta: {source: actionSources[actionTypes.DRIVER_UPDATE_AVAILABLE]}
      };
      expect(sync.driverUpdateAvailable(current, available)).to.deep.equal(expectedAction);
    });
  });

  describe('driverUpdateNotAvailable', () => {
    const updateInfo = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.driverUpdateNotAvailable(updateInfo);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate no driver update available', () => {
      const expectedAction = {
        type: actionTypes.DRIVER_UPDATE_NOT_AVAILABLE,
        meta: {source: actionSources[actionTypes.DRIVER_UPDATE_NOT_AVAILABLE]}
      };
      expect(sync.driverUpdateNotAvailable(updateInfo)).to.deep.equal(expectedAction);
    });
  });

  describe('dismissDriverUpdateAvailable', () => {
    test('should be an FSA', () => {
      let action = sync.dismissDriverUpdateAvailable();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate user dismissing driver update available modal', () => {
      const expectedAction = {
        type: actionTypes.DISMISS_DRIVER_UPDATE_AVAILABLE,
        meta: {source: actionSources[actionTypes.DISMISS_DRIVER_UPDATE_AVAILABLE]}
      };
      expect(sync.dismissDriverUpdateAvailable()).to.deep.equal(expectedAction);
    });
  });

  describe('driverInstall', () => {
    const updateInfo = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.driverInstall(updateInfo);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate a driver update install', () => {
      const expectedAction = {
        type: actionTypes.DRIVER_INSTALL,
        meta: {source: actionSources[actionTypes.DRIVER_INSTALL]}
      };
      expect(sync.driverInstall(updateInfo)).to.deep.equal(expectedAction);
    });
  });

  describe('driverUpdateShellOpts', () => {
    const opts = {'url':'http://example.com'};
    test('should be an FSA', () => {
      let action = sync.driverUpdateShellOpts(opts);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to set update script opts', () => {
      const expectedAction = {
        type: actionTypes.DRIVER_INSTALL_SHELL_OPTS,
        payload: { opts },
        meta: {source: actionSources[actionTypes.DRIVER_INSTALL_SHELL_OPTS]}
      };
      expect(sync.driverUpdateShellOpts(opts)).to.deep.equal(expectedAction);
    });
  });

  describe('deviceTimeIncorrect', () => {
    const callback = () => {},
      cfg = { config: 'value'},
      times = { time1: 'time' };
    test('should be an FSA', () => {
      let action = sync.deviceTimeIncorrect(callback, cfg, times);
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate user dismissing device time mismatch modal', () => {
      const expectedAction = {
        type: actionTypes.DEVICE_TIME_INCORRECT,
        payload: { callback, cfg, times },
        meta: {
          source: actionSources[actionTypes.DEVICE_TIME_INCORRECT],
          metric: {
            eventName: metrics.DEVICE_TIME_INCORRECT,
            properties: { times },
          },
        },
      };
      expect(sync.deviceTimeIncorrect(callback, cfg, times)).to.deep.equal(expectedAction);
    });
  });

  describe('dismissedDeviceTimePrompt', () => {
    test('should be an FSA', () => {
      let action = sync.dismissedDeviceTimePrompt();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate user dismissing device time mismatch modal', () => {
      const expectedAction = {
        type: actionTypes.DISMISS_DEVICE_TIME_PROMPT,
        meta: {source: actionSources[actionTypes.DISMISS_DEVICE_TIME_PROMPT]}
      };
      expect(sync.dismissedDeviceTimePrompt()).to.deep.equal(expectedAction);
    });
  });

  describe('timezoneBlur', () => {
    test('should be an FSA', () => {
      let action = sync.timezoneBlur();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate blur of timezone selector', () => {
      const expectedAction = {
        type: actionTypes.TIMEZONE_BLUR,
        meta: {source: actionSources[actionTypes.TIMEZONE_BLUR]}
      };
      expect(sync.timezoneBlur()).to.deep.equal(expectedAction);
    });
  });

  describe('adHocPairingRequest', () => {
    test('should be an FSA', () => {
      let action = sync.adHocPairingRequest();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate start of a 600 series ad hoc pairing', () => {
      const callback = () => {};
      const cfg = {conf: 'obj'};
      const expectedAction = {
        payload: { callback, cfg },
        type: actionTypes.AD_HOC_PAIRING_REQUEST,
        meta: {source: actionSources[actionTypes.AD_HOC_PAIRING_REQUEST]}
      };
      expect(sync.adHocPairingRequest(callback, cfg)).to.deep.equal(expectedAction);
    });
  });

  describe('adHocPairingDismissed', () => {
    test('should be an FSA', () => {
      let action = sync.dismissedAdHocPairingDialog();
      expect(isFSA(action)).to.be.true;
    });

    test('should create an action to indicate dismissing a 600 series ad hoc pairing', () => {
      const expectedAction = {
        type: actionTypes.AD_HOC_PAIRING_DISMISSED,
        meta: {source: actionSources[actionTypes.AD_HOC_PAIRING_DISMISSED]}
      };
      expect(sync.dismissedAdHocPairingDialog()).to.deep.equal(expectedAction);
    });
  });

  describe('fetchPatientsForClinicRequest', () => {
    test('should be an FSA', () => {
      let action = sync.fetchPatientsForClinicRequest();
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_PATIENTS_FOR_CLINIC_REQUEST', () => {
      let action = sync.fetchPatientsForClinicRequest();
      expect(action.type).to.equal('FETCH_PATIENTS_FOR_CLINIC_REQUEST');
    });
  });

  describe('fetchPatientsForClinicSuccess', () => {
    let clinicId = 'clinicId';
    let patients = [{clinicId: 'clinicId', patientId: 'patientId'}];
    test('should be an FSA', () => {
      let action = sync.fetchPatientsForClinicSuccess(patients);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_PATIENTS_FOR_CLINIC_SUCCESS', () => {
      let action = sync.fetchPatientsForClinicSuccess(clinicId, patients);
      expect(action.type).to.equal('FETCH_PATIENTS_FOR_CLINIC_SUCCESS');
      expect(action.payload.clinicId).to.equal(clinicId);
      expect(action.payload.patients).to.equal(patients);
    });
  });

  describe('fetchPatientsForClinicFailure', () => {
    test('should be an FSA', () => {
      let error = new Error('fetching patients for clinic failed :(');
      let action = sync.fetchPatientsForClinicFailure(error);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_PATIENTS_FOR_CLINIC_FAILURE and error should equal passed error', () => {
      let error = new Error('stink :(');
      let action = sync.fetchPatientsForClinicFailure(error);
      expect(action.type).to.equal('FETCH_PATIENTS_FOR_CLINIC_FAILURE');
      expect(action.error).to.equal(error);
    });
  });

  describe('createClinicCustodialAccountRequest', () => {
    test('should be an FSA', () => {
      let action = sync.createClinicCustodialAccountRequest();
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST', () => {
      let action = sync.createClinicCustodialAccountRequest();
      expect(action.type).to.equal('CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST');
    });
  });

  describe('createClinicCustodialAccountSuccess', () => {
    let patient = {clinicId: 'clinicId', patientId: 'patientId', id: 'patientUserId'};
    let clinicId = 'clinicId';
    let patientId = 'patientId';
    test('should be an FSA', () => {
      let action = sync.createClinicCustodialAccountSuccess(clinicId, patient, patientId);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS', () => {
      let action = sync.createClinicCustodialAccountSuccess(clinicId, patient, patientId);
      expect(action.type).to.equal('CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS');
      expect(action.payload.patient).to.equal(patient);
      expect(action.payload.clinicId).to.equal(clinicId);
      expect(action.payload.patientId).to.equal(patientId);
    });
  });

  describe('createClinicCustodialAccountFailure', () => {
    test('should be an FSA', () => {
      let error = new Error('fetching patients for clinic failed :(');
      let action = sync.createClinicCustodialAccountFailure(error);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE and error should equal passed error', () => {
      let error = new Error('stink :(');
      let action = sync.createClinicCustodialAccountFailure(error);
      expect(action.type).to.equal('CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE');
      expect(action.error).to.deep.include({message:getCreateCustodialAccountErrorMessage()});
    });
  });

  describe('updateClinicPatientRequest', () => {
    test('should be an FSA', () => {
      let action = sync.updateClinicPatientRequest();
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal UPDATE_CLINIC_PATIENT_REQUEST', () => {
      let action = sync.updateClinicPatientRequest();
      expect(action.type).to.equal('UPDATE_CLINIC_PATIENT_REQUEST');
    });
  });

  describe('updateClinicPatientSuccess', () => {
    let clinicId = 'clinicId';
    let patientId = 'patientId';
    let patient = { permissions: ['VIEW'] };
    test('should be an FSA', () => {
      let action = sync.updateClinicPatientSuccess(clinicId, patientId, patient);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal UPDATE_CLINIC_PATIENT_SUCCESS', () => {
      let action = sync.updateClinicPatientSuccess(clinicId, patientId, patient);
      expect(action.type).to.equal('UPDATE_CLINIC_PATIENT_SUCCESS');
      expect(action.payload.clinicId).to.equal(clinicId);
      expect(action.payload.patientId).to.equal(patientId);
      expect(action.payload.patient).to.equal(patient);
    });
  });

  describe('updateClinicPatientFailure', () => {
    test('should be an FSA', () => {
      let error = new Error('updating clinic patient failed :(');
      let action = sync.updateClinicPatientFailure(error);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal UPDATE_CLINIC_PATIENT_FAILURE and error should equal passed error', () => {
      let error = new Error('stink :(');
      let action = sync.updateClinicPatientFailure(error);
      expect(action.type).to.equal('UPDATE_CLINIC_PATIENT_FAILURE');
      expect(action.error).to.equal(true);
    });
  });

  describe('updateProfileRequest', () => {
    test('should be an FSA', () => {
      let action = sync.updateProfileRequest();

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal UPDATE_PROFILE_REQUEST', () => {
      let action = sync.updateProfileRequest();
      expect(action.type).to.equal('UPDATE_PROFILE_REQUEST');
    });
  });

  describe('updateProfileSuccess', () => {
    test('should be an FSA', () => {
      let patient = {
        name: 'Bruce Lee',
        age: 24
      };
      let action = sync.updateProfileSuccess(patient, 'user123');

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal UPDATE_PROFILE_SUCCESS', () => {
      let patient = {
        name: 'Jackie Chan',
        age: 24
      };
      let action = sync.updateProfileSuccess(patient, 'user123');

      expect(action.type).to.equal('UPDATE_PROFILE_SUCCESS');
      expect(action.payload.profile).to.equal(patient);
      expect(action.payload.userId).to.equal('user123');
    });
  });

  describe('updateProfileFailure', () => {
    test('should be an FSA', () => {
      let error = new Error(':(');
      let action = sync.updateProfileFailure(error);

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal UPDATE_PROFILE_FAILURE and error should equal passed error', () => {
      let error = new Error(getUpdateProfileErrorMessage());
      let action = sync.updateProfileFailure(error);

      expect(action.type).to.equal('UPDATE_PROFILE_FAILURE');
      expect(action.error).to.equal(true);
      expect(action.payload.message).to.equal(error.message);
    });
  });

  describe('fetchPatientRequest', () => {
    test('should be an FSA', () => {
      let action = sync.fetchPatientRequest();

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_PATIENT_REQUEST', () => {
      let action = sync.fetchPatientRequest();
      expect(action.type).to.equal('FETCH_PATIENT_REQUEST');
    });
  });

  describe('fetchPatientSuccess', () => {
    test('should be an FSA', () => {
      let patient = {
        name: 'Bruce Lee',
        age: 24
      };
      let action = sync.fetchPatientSuccess(patient);

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_PATIENT_SUCCESS', () => {
      let patient = {
        name: 'Jackie Chan',
        age: 24
      };
      let action = sync.fetchPatientSuccess(patient);

      expect(action.type).to.equal('FETCH_PATIENT_SUCCESS');
      expect(action.payload.patient).to.equal(patient);
    });
  });

  describe('fetchPatientFailure', () => {
    test('should be an FSA', () => {
      let error = new Error(':(');
      let action = sync.fetchPatientFailure(error);

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_PATIENT_FAILURE and error should equal passed error', () => {
      let error = new Error(':(');
      let action = sync.fetchPatientFailure(error);

      expect(action.type).to.equal('FETCH_PATIENT_FAILURE');
      expect(action.error).to.equal(error);
    });
  });

  describe('fetchAssociatedAccountsRequest', () => {
    test('should be an FSA', () => {
      let action = sync.fetchAssociatedAccountsRequest();

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_ASSOCIATED_ACCOUNTS_REQUEST', () => {
      let action = sync.fetchAssociatedAccountsRequest();
      expect(action.type).to.equal('FETCH_ASSOCIATED_ACCOUNTS_REQUEST');
    });
  });

  describe('fetchAssociatedAccountsSuccess', () => {
    test('should be an FSA', () => {
      let accounts = {
        patients: [{
          id: 20,
          name: 'Bruce Lee',
          age: 24
        }],
        dataDonationAccounts: [],
        careTeam: [],
      };
      let action = sync.fetchAssociatedAccountsSuccess(accounts);

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_ASSOCIATED_ACCOUNTS_SUCCESS', () => {
      let accounts = {
        patients: [{
          id: 20,
          name: 'Bruce Lee',
          age: 24
        }],
        dataDonationAccounts: [],
        careTeam: [],
      };
      let action = sync.fetchAssociatedAccountsSuccess(accounts);

      expect(action.type).to.equal('FETCH_ASSOCIATED_ACCOUNTS_SUCCESS');
      expect(action.payload.patients).to.equal(accounts.patients);
    });
  });

  describe('fetchAssociatedAccountsFailure', () => {
    test('should be an FSA', () => {
      let error = new Error(':(');
      let action = sync.fetchAssociatedAccountsFailure(error);

      expect(isFSA(action)).to.be.true;
    });

    test('type should equal FETCH_ASSOCIATED_ACCOUNTS_FAILURE and error should equal passed error', () => {
      let error = new Error(':(');
      let action = sync.fetchAssociatedAccountsFailure(error);

      expect(action.type).to.equal('FETCH_ASSOCIATED_ACCOUNTS_FAILURE');
      expect(action.error).to.equal(error);
    });
  });

  describe('getClinicsForClinicianRequest', () => {
    test('should be an FSA', () => {
      let action = sync.getClinicsForClinicianRequest();
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal GET_CLINICS_FOR_CLINICIAN_REQUEST', () => {
      let action = sync.getClinicsForClinicianRequest();
      expect(action.type).to.equal('GET_CLINICS_FOR_CLINICIAN_REQUEST');
    });
  });

  describe('getClinicsForClinicianSuccess', () => {
    let clinics = [
      {id: 'clinicId', name: 'Clinic Name'},
      {id: 'clinicId2', name: 'Clinic Name'},
    ];
    let clinicianId = 'clinician345';
    test('should be an FSA', () => {
      let action = sync.getClinicsForClinicianSuccess(clinics, clinicianId);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal GET_CLINICS_FOR_CLINICIAN_SUCCESS', () => {
      let action = sync.getClinicsForClinicianSuccess(clinics, clinicianId);
      expect(action.type).to.equal('GET_CLINICS_FOR_CLINICIAN_SUCCESS');
      expect(action.payload.clinics).to.equal(clinics);
      expect(action.payload.clinicianId).to.equal(clinicianId);
    });
  });

  describe('getClinicsForClinicianFailure', () => {
    test('should be an FSA', () => {
      let error = new Error('deleting clinic clinician failed :(');
      let action = sync.getClinicsForClinicianFailure(error);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal GET_CLINICS_FOR_CLINICIAN_FAILURE and error should equal passed error', () => {
      let error = new Error('stink :(');
      let action = sync.getClinicsForClinicianFailure(error);
      expect(action.type).to.equal('GET_CLINICS_FOR_CLINICIAN_FAILURE');
      expect(action.error).to.equal(error);
    });
  });

  describe('selectClinic', () => {
    let clinicId = 'clinic123';
    test('should be an FSA', () => {
      let action = sync.selectClinic(clinicId);
      expect(isFSA(action)).to.be.true;
    });

    test('type should equal SELECT_CLINIC', () => {
      let action = sync.selectClinic(clinicId);
      expect(action.type).to.equal('SELECT_CLINIC');
      expect(action.payload.clinicId).to.equal(clinicId);
    });
  });

  describe('acknowledgeNotification', () => {
    it('should be an FSA', () => {
      let action = sync.acknowledgeNotification();
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal ACKNOWLEDGE_NOTIFICATION', () => {
      let note = 'foo';
      let action = sync.acknowledgeNotification(note);

      expect(action.payload.acknowledgedNotification).to.equal(note);
      expect(action.type).to.equal('ACKNOWLEDGE_NOTIFICATION');
    });
  });

  describe('keycloakReady', () => {
    it('should be a FSA', () => {
      let event = 'onReady';
      let error = null;
      let action = sync.keycloakReady(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_READY', () => {
      let event = 'onReady';
      let error = null;
      let action = sync.keycloakReady(event, error);
      expect(action.type).to.equal('KEYCLOAK_READY');
      expect(action.payload.error).to.be.null;
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakInitError', () => {
    it('should be a FSA', () => {
      let event = 'onInitError';
      let error = new Error('Keycloak Init Failure');
      let action = sync.keycloakInitError(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_INIT_ERROR', () => {
      let event = 'onInitError';
      let error = new Error('Keycloak Init Failure');
      let action = sync.keycloakInitError(event, error);
      expect(action.type).to.equal('KEYCLOAK_INIT_ERROR');
      expect(action.payload.error).to.be.equal(error);
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakAuthSuccess', () => {
    it('should be a FSA', () => {
      let event = 'onAuthSuccess';
      let error = null;
      let action = sync.keycloakAuthSuccess(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_AUTH_SUCCESS', () => {
      let event = 'onAuthSuccess';
      let error = null;
      let action = sync.keycloakAuthSuccess(event, error);
      expect(action.type).to.equal('KEYCLOAK_AUTH_SUCCESS');
      expect(action.payload.error).to.be.null;
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakAuthError', () => {
    it('should be a FSA', () => {
      let event = 'onAuthError';
      let error = new Error('Keycloak Auth Failure');
      let action = sync.keycloakAuthError(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_AUTH_ERROR', () => {
      let event = 'onAuthError';
      let error = new Error('Keycloak Auth Failure');
      let action = sync.keycloakAuthError(event, error);
      expect(action.type).to.equal('KEYCLOAK_AUTH_ERROR');
      expect(action.payload.error).to.be.equal(error);
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakAuthRefreshSuccess', () => {
    it('should be a FSA', () => {
      let event = 'onAuthRefreshSuccess';
      let error = null;
      let action = sync.keycloakAuthRefreshSuccess(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_AUTH_REFRESH_SUCCESS', () => {
      let event = 'onAuthRefreshSuccess';
      let error = null;
      let action = sync.keycloakAuthRefreshSuccess(event, error);
      expect(action.type).to.equal('KEYCLOAK_AUTH_REFRESH_SUCCESS');
      expect(action.payload.error).to.be.null;
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakAuthRefreshError', () => {
    it('should be a FSA', () => {
      let event = 'onAuthRefreshError';
      let error = new Error('Keycloak Auth Refresh Failure');
      let action = sync.keycloakAuthRefreshError(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_AUTH_REFRESH_ERROR', () => {
      let event = 'onAuthRefreshError';
      let error = new Error('Keycloak Auth Refresh Failure');
      let action = sync.keycloakAuthRefreshError(event, error);
      expect(action.type).to.equal('KEYCLOAK_AUTH_REFRESH_ERROR');
      expect(action.payload.error).to.be.equal(error);
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakTokenExpired', () => {
    it('should be a FSA', () => {
      let event = 'onTokenExpired';
      let error = null;
      let action = sync.keycloakTokenExpired(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_TOKEN_EXPIRED', () => {
      let event = 'onTokenExpired';
      let error = null;
      let action = sync.keycloakTokenExpired(event, error);
      expect(action.type).to.equal('KEYCLOAK_TOKEN_EXPIRED');
      expect(action.payload.error).to.be.null;
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakAuthLogout', () => {
    it('should be a FSA', () => {
      let event = 'onAuthLogout';
      let error = null;
      let action = sync.keycloakAuthLogout(event, error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_AUTH_LOGOUT', () => {
      let event = 'onAuthLogout';
      let error = null;
      let action = sync.keycloakAuthLogout(event, error);
      expect(action.type).to.equal('KEYCLOAK_AUTH_LOGOUT');
      expect(action.payload.error).to.be.null;
      expect(action.payload.event).to.equal(event);
    });
  });

  describe('keycloakTokensReceived', () => {
    it('should be a FSA', () => {
      let tokens = {token: 'token123'};
      let action = sync.keycloakTokensReceived(tokens);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal KEYCLOAK_TOKENS_RECEIVED', () => {
      let tokens = {token: 'token123'};
      let action = sync.keycloakTokensReceived(tokens);
      expect(action.type).to.equal('KEYCLOAK_TOKENS_RECEIVED');
      expect(action.payload.tokens.token).to.equal('token123');
    });
  });

  describe('fetchInfoRequest', () => {
    it('should be a FSA', () => {
      let action = sync.fetchInfoRequest();
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal FETCH_INFO_REQUEST', () => {
      let action = sync.fetchInfoRequest();
      expect(action.type).to.equal('FETCH_INFO_REQUEST');
    });
  });

  describe('fetchInfoSuccess', () => {
    const info = {
      auth: {
        url: 'someUrl',
        realm: 'anAwesomeRealm'
      }
    };

    it('should be a FSA', () => {
      let action = sync.fetchInfoSuccess(info);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal FETCH_INFO_SUCCESS', () => {
      let action = sync.fetchInfoSuccess(info);
      expect(action.type).to.equal('FETCH_INFO_SUCCESS');
      expect(action.payload.info).to.equal(info);
    });
  });

  describe('fetchInfoFailure', () => {
    it('should be a FSA', () => {
      let error = new Error('fetching info failed :(');
      let action = sync.fetchInfoFailure(error);
      expect(isFSA(action)).to.be.true;
    });

    it('type should equal FETCH_INFO_FAILURE and error should equal passed error', () => {
      let error = new Error('stink :(');
      let action = sync.fetchInfoFailure(error);
      expect(action.type).to.equal('FETCH_INFO_FAILURE');
      expect(action.error).to.equal(true);
      expect(action.payload).to.equal(error);
    });
  });

});
