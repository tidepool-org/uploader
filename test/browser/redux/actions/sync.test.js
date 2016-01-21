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

/*eslint-env mocha*/

import { isFSA } from 'flux-standard-action';

import * as actionSources from '../../../../lib/redux/constants/actionSources';
import * as actionTypes from '../../../../lib/redux/constants/actionTypes';
import * as metrics from '../../../../lib/redux/constants/metrics';

import * as syncActions from '../../../../lib/redux/actions/sync';
import { errorText } from '../../../../lib/redux/utils/errors';

describe('Synchronous Actions', () => {
  describe('addTargetDevice', () => {
    const DEVICE = 'a_pump', ID = 'a1b2c3';
    it('should be an FSA', () => {
      let action = syncActions.addTargetDevice(ID, DEVICE);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to add a device to a user\'s target devices', () => {
      const expectedAction = {
        type: actionTypes.ADD_TARGET_DEVICE,
        payload: {userId: ID, deviceKey: DEVICE},
        meta: {source: actionSources[actionTypes.ADD_TARGET_DEVICE]}
      };
      expect(syncActions.addTargetDevice(ID, DEVICE)).to.deep.equal(expectedAction);
    });
  });

  describe('hideUnavailableDevices', () => {
    const OS = 'test';
    it('should be an FSA', () => {
      let action = syncActions.hideUnavailableDevices(OS);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to hide devices unavailable on given operating system', () => {
      const expectedAction = {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: OS},
        meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
      };
      expect(syncActions.hideUnavailableDevices(OS)).to.deep.equal(expectedAction);
    });
  });

  describe('removeTargetDevice', () => {
    const DEVICE = 'a_pump', ID = 'a1b2c3';
    it('should be an FSA', () => {
      let action = syncActions.removeTargetDevice(ID, DEVICE);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to remove a device from a user\'s target devices', () => {
      const expectedAction = {
        type: actionTypes.REMOVE_TARGET_DEVICE,
        payload: {userId: ID, deviceKey: DEVICE},
        meta: {source: actionSources[actionTypes.REMOVE_TARGET_DEVICE]}
      };
      expect(syncActions.removeTargetDevice(ID, DEVICE)).to.deep.equal(expectedAction);
    });
  });

  describe('setForgotPasswordUrl', () => {
    const URL = 'http://www.acme.com/forgot-password';
    it('should be an FSA', () => {
      let action = syncActions.setForgotPasswordUrl(URL);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the forgot password url', () => {
      const expectedAction = {
        type: actionTypes.SET_FORGOT_PASSWORD_URL,
        payload: {url: URL},
        meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
      };
      expect(syncActions.setForgotPasswordUrl(URL)).to.deep.equal(expectedAction);
    });
  });

  describe('setOs', () => {
    const OS = 'mac';
    it('should be an FSA', () => {
      let action = syncActions.setOs(OS);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the operating system', () => {
      const expectedAction = {
        type: actionTypes.SET_OS,
        payload: {os: OS},
        meta: {source: actionSources[actionTypes.SET_OS]}
      };
      expect(syncActions.setOs(OS)).to.deep.equal(expectedAction);
    });
  });

  describe('setPage', () => {
    const PAGE = 'FOO';
    it('should be an FSA', () => {
      let action = syncActions.setPage(PAGE);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the page', () => {
      const expectedAction = {
        type: actionTypes.SET_PAGE,
        payload: {page: PAGE},
        meta: {source: actionSources[actionTypes.SET_PAGE]}
      };
      expect(syncActions.setPage(PAGE)).to.deep.equal(expectedAction);
    });

    it('should accept a second parameter to override the default action source', () => {
      const expectedAction = {
        type: actionTypes.SET_PAGE,
        payload: {page: PAGE},
        meta: {source: actionSources.USER}
      };
      expect(syncActions.setPage(PAGE, actionSources.USER)).to.deep.equal(expectedAction);
    });
  });

  describe('setSignUpUrl', () => {
    const URL = 'http://www.acme.com/sign-up';
    it('should be an FSA', () => {
      let action = syncActions.setSignUpUrl(URL);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the sign-up url', () => {
      const expectedAction = {
        type: actionTypes.SET_SIGNUP_URL,
        payload: {url: URL},
        meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
      };
      expect(syncActions.setSignUpUrl(URL)).to.deep.equal(expectedAction);
    });
  });

  describe('setTargetTimezone', () => {
    const TIMEZONE = 'Europe/Budapest', ID = 'a1b2c3';
    it('should be an FSA', () => {
      let action = syncActions.setTargetTimezone(ID, TIMEZONE);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the target timezone for a user', () => {
      const expectedAction = {
        type: actionTypes.SET_TARGET_TIMEZONE,
        payload: {userId: ID, timezoneName: TIMEZONE},
        meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]}
      };
      expect(syncActions.setTargetTimezone(ID, TIMEZONE)).to.deep.equal(expectedAction);
    });
  });

  describe('setUploadTargetUser', () => {
    const ID = 'a1b2c3';
    it('should be an FSA', () => {
      let action = syncActions.setUploadTargetUser(ID);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the target user for data upload', () => {
      const expectedAction = {
        type: actionTypes.SET_UPLOAD_TARGET_USER,
        payload: {userId: ID},
        meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
      };
      expect(syncActions.setUploadTargetUser(ID)).to.deep.equal(expectedAction);
    });
  });

  describe('setVersion', () => {
    const VERSION = '0.100.0';
    it('should be an FSA', () => {
      let action = syncActions.setVersion(VERSION);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to set the uploader version', () => {
      const expectedAction = {
        type: actionTypes.SET_VERSION,
        payload: {version: VERSION},
        meta: {source: actionSources[actionTypes.SET_VERSION]}
      };
      expect(syncActions.setVersion(VERSION)).to.deep.equal(expectedAction);
    });
  });

  describe('toggleDropdown', () => {
    const DROPDOWN_PREVIOUS_STATE = true;
    it('should be an FSA', () => {
      let action = syncActions.toggleDropdown(DROPDOWN_PREVIOUS_STATE);

      expect(isFSA(action)).to.be.true;
    });

    it('should create an action to toggle the dropdown menu', () => {
      const expectedAction = {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false},
        meta: {source: actionSources[actionTypes.TOGGLE_DROPDOWN]}
      };
      expect(syncActions.toggleDropdown(DROPDOWN_PREVIOUS_STATE)).to.deep.equal(expectedAction);
    });

    it('should accept a second parameter to override the default action source', () => {
      const expectedAction = {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false},
        meta: {source: actionSources.UNDER_THE_HOOD}
      };
      expect(syncActions.toggleDropdown(DROPDOWN_PREVIOUS_STATE, actionSources.UNDER_THE_HOOD)).to.deep.equal(expectedAction);
    });
  });

  describe('for doAppInit', () => {
    describe('initRequest', () => {
      it('should be an FSA', () => {
        let action = syncActions.initRequest();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to record the start of app initialization', () => {
        const expectedAction = {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        };
        expect(syncActions.initRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('initSuccess', () => {
      it('should be an FSA', () => {
        let action = syncActions.initSuccess();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to record the successful completion of app initialization', () => {
        const expectedAction = {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        };
        expect(syncActions.initSuccess()).to.deep.equal(expectedAction);
      });
    });

    describe('initFailure', () => {
      it('should be an FSA', () => {
        let action = syncActions.initFailure();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to record early exit from app initialization due to error', () => {
        const expectedAction = {
          type: actionTypes.INIT_APP_FAILURE,
          error: true,
          payload: new Error(errorText.E_INIT),
          meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
        };
        expect(syncActions.initFailure()).to.deep.equal(expectedAction);
      });
    });

    describe('setUserInfoFromToken', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const user = {userid: 'abc123'};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      it('should be an FSA', () => {
        let action = syncActions.setUserInfoFromToken({ user, profile, memberships });
        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to set the logged-in user (plus user\'s profile, careteam memberships)', () => {
        const expectedAction = {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: { user, profile, memberships },
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        };
        expect(syncActions.setUserInfoFromToken({ user, profile, memberships })).to.deep.equal(expectedAction);
      });
    });
  });

  describe('for doLogin', () => {
    describe('loginRequest', () => {
      it('should be an FSA', () => {
        let action = syncActions.loginRequest();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to record the start of user login', () => {
        const expectedAction = {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        };
        expect(syncActions.loginRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('loginSuccess', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const user = {userid: 'abc123'};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      it('should be an FSA', () => {
        expect(isFSA(syncActions.loginSuccess({ user, profile, memberships }))).to.be.true;
      });

      it('should create an action to set the logged-in user (plus user\'s profile, careteam memberships)', () => {
        const expectedAction = {
          type: actionTypes.LOGIN_SUCCESS,
          payload: { user, profile, memberships },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: {eventName: metrics.LOGIN_SUCCESS}
          }
        };
        expect(syncActions.loginSuccess({ user, profile, memberships })).to.deep.equal(expectedAction);
      });
    });

    describe('loginFailure', () => {
      const err = 'Login error!';
      it('should be an FSA', () => {
        let action = syncActions.loginFailure(err);

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to report a login error', () => {
        syncActions.__Rewire__('getLoginErrorMessage', () => err);
        const expectedAction = {
          type: actionTypes.LOGIN_FAILURE,
          error: true,
          payload: new Error(err),
          meta: {source: actionSources[actionTypes.LOGIN_FAILURE]}
        };
        expect(syncActions.loginFailure(err)).to.deep.equal(expectedAction);
        syncActions.__ResetDependency__('getLoginErrorMessage');
      });
    });
  });

  describe('for doLogout', () => {
    describe('logoutRequest', () => {
      it('should be an FSA', () => {
        let action = syncActions.logoutRequest();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to request logout and clear logged-in user related state', () => {
        const expectedAction = {
          type: actionTypes.LOGOUT_REQUEST,
          meta: {
            source: actionSources[actionTypes.LOGOUT_REQUEST],
            metric: {eventName: metrics.LOGOUT_REQUEST}
          }
        };
        expect(syncActions.logoutRequest()).to.deep.equal(expectedAction);
      });
    });

    describe('logoutSuccess', () => {
      it('should be an FSA', () => {
        let action = syncActions.logoutSuccess();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to announce the success of logout', () => {
        const expectedAction = {
          type: actionTypes.LOGOUT_SUCCESS,
          meta: {source: actionSources[actionTypes.LOGOUT_SUCCESS]}
        };
        expect(syncActions.logoutSuccess()).to.deep.equal(expectedAction);
      });
    });

    describe('logoutFailure', () => {
      const err = 'Logout error!';
      it('should be an FSA', () => {
        let action = syncActions.logoutFailure(err);

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to report a logout error', () => {
        syncActions.__Rewire__('getLogoutErrorMessage', () => err);
        const expectedAction = {
          type: actionTypes.LOGOUT_FAILURE,
          error: true,
          payload: new Error(err),
          meta: {source: actionSources[actionTypes.LOGOUT_FAILURE]}
        };
        expect(syncActions.logoutFailure(err)).to.deep.equal(expectedAction);
        syncActions.__ResetDependency__('getLoginErrorMessage');
      });
    });
  });

  describe('for retrieveTargetsFromStorage', () => {
    describe('putUsersTargetsInStorage', () => {
      it('should be an FSA', () => {
        let action = syncActions.putUsersTargetsInStorage();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to announce the side effet of storing users\' targets locally', () => {
        const expectedAction = {
          type: actionTypes.STORING_USERS_TARGETS,
          meta: {source: actionSources[actionTypes.STORING_USERS_TARGETS]}
        };
        expect(syncActions.putUsersTargetsInStorage()).to.deep.equal(expectedAction);
      });
    });

    describe('retrieveUsersTargetsFromStorage', () => {
      it('should be an FSA', () => {
        let action = syncActions.retrieveUsersTargetsFromStorage();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to announce the side effet of storing users\' targets locally', () => {
        const expectedAction = {
          type: actionTypes.RETRIEVING_USERS_TARGETS,
          meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
        };
        expect(syncActions.retrieveUsersTargetsFromStorage()).to.deep.equal(expectedAction);
      });
    });

    describe('setUsersTargets', () => {
      // NB: this is not what this object actually looks like
      // actual shape is irrelevant to testing action creators
      const targets = {
        a1b2c3: ['foo', 'bar'],
        d4e5f6: ['baz']
      };
      it('should be an FSA', () => {
        let action = syncActions.setUsersTargets();

        expect(isFSA(action)).to.be.true;
      });

      it('should create an action to set the users\' target devices', () => {
        const expectedAction = {
          type: actionTypes.SET_USERS_TARGETS,
          payload: { targets },
          meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
        };
        expect(syncActions.setUsersTargets(targets)).to.deep.equal(expectedAction);
      });
    });
  });
});