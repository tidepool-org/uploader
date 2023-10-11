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


import _ from 'lodash';
import { isFSA } from 'flux-standard-action';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { expect } from 'chai';
import sinon from 'sinon';

import initialState from '../../../app/reducers/initialState';
import * as actionSources from '../../../app/constants/actionSources';
import * as actionTypes from '../../../app/constants/actionTypes';
import * as metrics from '../../../app/constants/metrics';
import { pages, steps, urls } from '../../../app/constants/otherConstants';
import { UnsupportedError } from '../../../app/utils/errors';
import ErrorMessages from '../../../app/constants/errorMessages';
import UserMessages from '../../../app/constants/usrMessages';

import * as async from '../../../app/actions/async';
import { __Rewire__, __ResetDependency__ } from '../../../app/actions/async';
import { __RewireAPI__ as utilsRewireAPI } from '../../../app/actions/utils';
import {
  getLoginErrorMessage,
  getLogoutErrorMessage,
  getUpdateProfileErrorMessage,
  getCreateCustodialAccountErrorMessage,
} from '../../../app/utils/errors';

let pwd = require('../../lib/fixtures/pwd.json');
let nonpwd = require('../../lib/fixtures/nonpwd.json');

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

jest.mock('@electron/remote', () => ({
  getGlobal: (string) => {
    if (string === 'i18n') {
        return { t: (string) => string };
    }
  }
}));

describe('Asynchronous Actions', () => {
  afterEach(() => {
    // very important to do this in an afterEach than in each test when __Rewire__ is used
    // if you try to reset within each test you'll make it impossible for tests to fail!
    __ResetDependency__('services');
  });

  describe('doAppInit [hot reload, app already initialized]', () => {
    test('should dispatch no actions!', () => {
      const expectedActions = [];
      const store = mockStore({
        working: { initializingApp: { inProgress: false } },
      });
      utilsRewireAPI.__Rewire__('initOSDetails', () => {});
      store.dispatch(async.doAppInit({}, {})).then(() => {
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doAppInit [no session token in local storage]', () => {
    test('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_NEW_PATIENT_URL, SET_PAGE, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS actions', () => {
      const config = {
        os: 'test',
        version: '0.100.0',
        API_URL: 'http://www.acme.com'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb(); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          setHosts: _.noop,
          upload: {
            getVersions: (cb) => { cb(null, {uploaderMinimum: config.version}); }
          }
        },
        device: {
          init: (opts, cb) => { cb(); }
        },
        localStore: {
          init: (opts, cb) => { cb(); },
          getInitialState: _.noop
        },
        log: _.noop
      };
      const expectedActions = [
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.SET_FORGOT_PASSWORD_URL,
          payload: {url: 'http://www.acme.com/request-password-from-uploader'},
          meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
        },
        {
          type: actionTypes.SET_SIGNUP_URL,
          payload: {url: 'http://www.acme.com/signup'},
          meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
        },
        {
          type: actionTypes.SET_NEW_PATIENT_URL,
          payload: {url: 'http://www.acme.com/patients/new'},
          meta: {source: actionSources[actionTypes.SET_NEW_PATIENT_URL]}
        },
        {
          type: actionTypes.SET_BLIP_URL,
          payload: {url: 'http://www.acme.com/'},
          meta: {source: actionSources[actionTypes.SET_BLIP_URL]}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/login',
              state: {
                meta: {source: actionSources[actionTypes.SET_PAGE]}
              }
            } ],
            method: 'push'
          }
        },
        {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        },
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        }
      ];
      __Rewire__('versionInfo', {
        semver: config.version
      });
      const store = mockStore({
        working: { initializingApp: { inProgress: true } },
      });
      store.dispatch(async.doAppInit(config, servicesToInit)).then(() => {
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doAppInit [with session token in local storage]', () => {
    test('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_NEW_PATIENT_URL, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, SET_USER_INFO_FROM_TOKEN, SET_BLIP_VIEW_DATA_URL, RETRIEVING_USERS_TARGETS, SET_PAGE actions', () => {
      const config = {
        os: 'test',
        version: '0.100.0',
        API_URL: 'http://www.acme.com'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb(null, {token: 'iAmAToken'}); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          setHosts: _.noop,
          upload: {
            getVersions: (cb) => { cb(null, {uploaderMinimum: config.version}); }
          },
          user: {
            initializationInfo: (cb) => { cb(null, [pwd.user, pwd.profile, pwd.memberships, {}, []] ); }
          }
        },
        device: {
          init: (opts, cb) => { cb(); }
        },
        localStore: {
          init: (opts, cb) => { cb(); },
          getInitialState: _.noop,
          getItem: () => null
        },
        log: _.noop
      };
      const expectedActions = [
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.SET_FORGOT_PASSWORD_URL,
          payload: {url: 'http://www.acme.com/request-password-from-uploader'},
          meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
        },
        {
          type: actionTypes.SET_SIGNUP_URL,
          payload: {url: 'http://www.acme.com/signup'},
          meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
        },
        {
          type: actionTypes.SET_NEW_PATIENT_URL,
          payload: {url: 'http://www.acme.com/patients/new'},
          meta: {source: actionSources[actionTypes.SET_NEW_PATIENT_URL]}
        },
        {
          type: actionTypes.SET_BLIP_URL,
          payload: {url: 'http://www.acme.com/'},
          meta: {source: actionSources[actionTypes.SET_BLIP_URL]}
        },
        {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        },
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: {user: pwd.user, profile: pwd.profile, memberships: pwd.memberships},
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {clinicianId: pwd.user.userid, clinics: []},
        },
        {
          type: actionTypes.SET_BLIP_VIEW_DATA_URL,
          payload: {url: `http://www.acme.com/patients/${pwd.user.userid}/data`},
          meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
        },
        {
          type: actionTypes.RETRIEVING_USERS_TARGETS,
          meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/settings',
              state: {
                meta: {source: actionSources[actionTypes.SET_PAGE]}
              }
            } ],
            method: 'push'
          }
        }
      ];
      __Rewire__('versionInfo', {
        semver: config.version
      });
      const state = {
        allUsers: { [pwd.user.userid]: pwd.user },
        uploadTargetUser: pwd.user.userid,
        working: { initializingApp: { inProgress: true } },
        targetUsersForUpload: pwd.memberships.map(user=>user.userid),
      };
      const store = mockStore(state);
      store.dispatch(async.doAppInit(config, servicesToInit)).then(() => {
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doAppInit [saved session token, verified clinic account]', () => {
    test('should dispatch INIT_APP_REQUEST, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_NEW_PATIENT_URL, SET_BLIP_URL, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, SET_USER_INFO_FROM_TOKEN, GET_CLINICS_FOR_CLINICIAN_SUCCESS, and SET_PAGE (CLINIC_USER_SELECT) actions', () => {
      const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const clinics = [];
      const config = {
        os: 'test',
        version: '0.100.0',
        API_URL: 'http://www.acme.com'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb(null, {token: 'iAmAToken'}); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          setHosts: _.noop,
          upload: {
            getVersions: (cb) => { cb(null, {uploaderMinimum: config.version}); }
          },
          user: {
            initializationInfo: (cb) => { cb(null, [userObj.user, profile, memberships, {}, clinics] ); },
            loginExtended: (creds, opts, cb) => cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) => cb(null, {
              patients: memberships,
              dataDonationAccounts: [],
              careTeam: [],
            }),
          },
          clinics: {
            getClinicsForClinician: (clinician, options, cb) => cb(null, []),
          },
        },
        device: {
          init: (opts, cb) => { cb(); }
        },
        localStore: {
          init: (opts, cb) => { cb(); },
          getInitialState: _.noop,
          getItem: () => null
        },
        log: _.noop
      };

      const expectedActions = [
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.SET_FORGOT_PASSWORD_URL,
          payload: {url: 'http://www.acme.com/request-password-from-uploader'},
          meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
        },
        {
          type: actionTypes.SET_SIGNUP_URL,
          payload: {url: 'http://www.acme.com/signup'},
          meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
        },
        {
          type: actionTypes.SET_NEW_PATIENT_URL,
          payload: {url: 'http://www.acme.com/patients/new'},
          meta: {source: actionSources[actionTypes.SET_NEW_PATIENT_URL]}
        },
        {
          type: actionTypes.SET_BLIP_URL,
          payload: {url: 'http://www.acme.com/'},
          meta: {source: actionSources[actionTypes.SET_BLIP_URL]}
        },
        {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        },
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: {user: userObj.user, profile: profile, memberships: memberships},
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {clinicianId: userObj.user.userid, clinics: []},
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/clinic_user_select',
              state: {
                meta: {
                  metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED},
                  source: actionSources.USER
                }
              }
            } ],
            method: 'push'
          }
        },
      ];
      const store = mockStore({
        allUsers: { [userObj.user.userid]: userObj.user },
        targetUsersForUpload: ['def456', 'ghi789'],
        working: { initializingApp: { inProgress: true } },
      });
      store.dispatch(async.doAppInit(config, servicesToInit)).then(() => {
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doAppInit [saved session token, new clinic account]', () => {
    test('should dispatch INIT_APP_REQUEST, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_NEW_PATIENT_URL, SET_BLIP_URL, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, SET_USER_INFO_FROM_TOKEN, GET_CLINICS_FOR_CLINICIAN_SUCCESS, FETCH_PATIENTS_FOR_CLINIC_REQUEST, FETCH_PATIENTS_FOR_CLINIC_SUCCESS, SELECT_CLINIC, and SET_PAGE (CLINIC_USER_SELECT) actions', () => {
      const userObj = {user: {userid: 'abc123', roles: ['clinician']}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const clinics = [{ clinic: { id: 'clinicId' } }];
      const config = {
        os: 'test',
        version: '0.100.0',
        API_URL: 'http://www.acme.com'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb(null, {token: 'iAmAToken'}); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          setHosts: _.noop,
          upload: {
            getVersions: (cb) => { cb(null, {uploaderMinimum: config.version}); }
          },
          user: {
            initializationInfo: (cb) => { cb(null, [userObj.user, profile, memberships, {}, clinics] ); },
            loginExtended: (creds, opts, cb) =>
              cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) =>
              cb(null, {
                patients: memberships,
                dataDonationAccounts: [],
                careTeam: [],
              }),
          },
          clinics: {
            getClinicsForClinician: (clinician, options, cb) =>
              cb(null, [{ clinic: { id: 'clinicId' } }]),
            getPatientsForClinic: (clinicId, options, cb) =>
              cb(null, { data: [{ patient: 'patient1' }], meta: { count: 1 } }),
          },
        },
        device: {
          init: (opts, cb) => { cb(); }
        },
        localStore: {
          init: (opts, cb) => { cb(); },
          getInitialState: _.noop,
          getItem: () => null
        },
        log: _.noop
      };

      const expectedActions = [
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.SET_FORGOT_PASSWORD_URL,
          payload: {url: 'http://www.acme.com/request-password-from-uploader'},
          meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
        },
        {
          type: actionTypes.SET_SIGNUP_URL,
          payload: {url: 'http://www.acme.com/signup'},
          meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
        },
        {
          type: actionTypes.SET_NEW_PATIENT_URL,
          payload: {url: 'http://www.acme.com/patients/new'},
          meta: {source: actionSources[actionTypes.SET_NEW_PATIENT_URL]}
        },
        {
          type: actionTypes.SET_BLIP_URL,
          payload: {url: 'http://www.acme.com/'},
          meta: {source: actionSources[actionTypes.SET_BLIP_URL]}
        },
        {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        },
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: {user: userObj.user, profile: profile, memberships: memberships},
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: clinics,
          },
        },
        {
          type: actionTypes.FETCH_PATIENTS_FOR_CLINIC_REQUEST
        },
        {
          type: actionTypes.FETCH_PATIENTS_FOR_CLINIC_SUCCESS,
          payload: {
            clinicId: 'clinicId',
            patients: [{ patient: 'patient1' }],
            count: 1,
          }
        },
        {
          type: actionTypes.SELECT_CLINIC,
          payload: {clinicId:'clinicId'}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/clinic_user_select',
              state: {
                meta: {
                  metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED},
                  source: actionSources.USER
                }
              }
            } ],
            method: 'push'
          }
        },
      ];

      const store = mockStore({
        allUsers: { [userObj.user.userid]: userObj.user },
        targetUsersForUpload: ['def456', 'ghi789'],
        working: { initializingApp: { inProgress: true } },
      });
      store.dispatch(async.doAppInit(config, servicesToInit)).then(() => {
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doAppInit [saved session token, new clinic account] multiple clinics', () => {
    test('should dispatch INIT_APP_REQUEST, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_NEW_PATIENT_URL, SET_BLIP_URL, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, SET_USER_INFO_FROM_TOKEN, GET_CLINICS_FOR_CLINICIAN_SUCCESS, and SET_PAGE (WORKSPACE_SWITCH) actions', () => {
      const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const clinics = [
        { clinic: { id: 'clinicId' } },
        { clinic: { id: 'clinicId2' } },
      ];
      const config = {
        os: 'test',
        version: '0.100.0',
        API_URL: 'http://www.acme.com'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb(null, {token: 'iAmAToken'}); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          setHosts: _.noop,
          upload: {
            getVersions: (cb) => { cb(null, {uploaderMinimum: config.version}); }
          },
          user: {
            initializationInfo: (cb) => { cb(null, [userObj.user, profile, memberships, {}, clinics] ); },
            loginExtended: (creds, opts, cb) =>
              cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) =>
              cb(null, {
                patients: memberships,
                dataDonationAccounts: [],
                careTeam: [],
              }),
          },
          clinics: {
            getClinicsForClinician: (clinician, options, cb) =>
              cb(null, clinics),
            getPatientsForClinic: (clinicId, options, cb) =>
              cb(null, { data: [{ patient: 'patient1' }], meta: { count: 1 } }),
          },
        },
        device: {
          init: (opts, cb) => { cb(); }
        },
        localStore: {
          init: (opts, cb) => { cb(); },
          getInitialState: _.noop,
          getItem: () => null
        },
        log: _.noop
      };

      const expectedActions = [
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.SET_FORGOT_PASSWORD_URL,
          payload: {url: 'http://www.acme.com/request-password-from-uploader'},
          meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
        },
        {
          type: actionTypes.SET_SIGNUP_URL,
          payload: {url: 'http://www.acme.com/signup'},
          meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
        },
        {
          type: actionTypes.SET_NEW_PATIENT_URL,
          payload: {url: 'http://www.acme.com/patients/new'},
          meta: {source: actionSources[actionTypes.SET_NEW_PATIENT_URL]}
        },
        {
          type: actionTypes.SET_BLIP_URL,
          payload: {url: 'http://www.acme.com/'},
          meta: {source: actionSources[actionTypes.SET_BLIP_URL]}
        },
        {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        },
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: {user: userObj.user, profile: profile, memberships: memberships},
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: clinics,
          },
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/workspace_switch',
              state: {
                meta: {
                  metric: {eventName: metrics.WORKSPACE_SWITCH_DISPLAYED},
                  source: actionSources.USER
                }
              }
            } ],
            method: 'push'
          }
        },
      ];
      const store = mockStore({
        allUsers: { [pwd.user.userid]: pwd.user },
        targetUsersForUpload: ['def456', 'ghi789'],
        working: { initializingApp: { inProgress: true } },
      });
      store.dispatch(async.doAppInit(config, servicesToInit)).then(() => {
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doAppInit [with error in api init]', () => {
    test('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, INIT_APP_FAILURE actions', () => {
      const config = {
        os: 'test',
        version: '0.100.0',
        API_URL: 'http://www.acme.com/'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb('Error!'); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com/' + path;
          },
          setHosts: _.noop
        },
        device: {
          init: (opts, cb) => { cb(); }
        },
        localStore: {
          init: (opts, cb) => { cb(); },
          getInitialState: _.noop
        },
        log: _.noop
      };
      const expectedActions = [
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.INIT_APP_FAILURE,
          error: true,
          payload: new Error(ErrorMessages.E_INIT),
          meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
        }
      ];
      __Rewire__('versionInfo', {
        semver: config.version
      });
      const store = mockStore({
        working: { initializingApp: { inProgress: true } },
      });
      store.dispatch(async.doAppInit(config, servicesToInit)).then(() => {
        const actions = store.getActions();
        expect(actions[2].payload).to.deep.include({message:ErrorMessages.E_INIT});
        expectedActions[2].payload = actions[2].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doLogin [no error]', () => {
    test('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS, SET_BLIP_VIEW_DATA_URL, RETRIEVING_USERS_TARGETS, SET_PAGE (SETTINGS) actions', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123'}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: { source: actionSources[actionTypes.LOGIN_REQUEST] },
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_REQUEST,
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS,
          payload: {
            careTeam: [],
            dataDonationAccounts: [],
            patients: memberships,
          },
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_REQUEST
        },
        {
          type: actionTypes.LOGIN_SUCCESS,
          payload: {
            user: userObj.user,
            profile,
            memberships,
          },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: { eventName: metrics.LOGIN_SUCCESS },
          },
        },
        {
          type: actionTypes.SET_BLIP_VIEW_DATA_URL,
          payload: {
            url: `http://www.acme.com/patients/${userObj.user.userid}/data`,
          },
          meta: { source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL] },
        },
        {
          type: actionTypes.RETRIEVING_USERS_TARGETS,
          meta: { source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS] },
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [
              {
                pathname: '/settings',
                state: {
                  meta: { source: actionSources[actionTypes.SET_PAGE] },
                },
              },
            ],
            method: 'push',
          },
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: [],
          }
        },
      ];
      __Rewire__('services', {
        api: {
          user: {
            loginExtended: (creds, opts, cb) => cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) => cb(null, {
              patients: memberships,
              dataDonationAccounts: [],
              careTeam: [],
            })
          },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          clinics: {
            getClinicsForClinician: (clinicianId, options, cb) => cb(null, []),
            getEHRSettings: (clinicId, cb) => cb(null, {}),
            getMRNSettings: (clinicId, cb) => cb(null, {}),
          }
        },
        log: _.noop,
        localStore: {
          getItem: () => null,
          setItem: () => null
        }
      });
      const store = mockStore({
        allUsers: {[userObj.user.userid]:userObj.user},
        uploadTargetUser: userObj.user.userid,
        targetUsersForUpload: ['def456', 'ghi789'],
        working: {
          loggingIn: {
            inProgress: false
          }
        }
      });
      store.dispatch(async.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogin [with error]', () => {
    test('should dispatch LOGIN_REQUEST, LOGIN_FAILURE actions', () => {
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        },
        {
          type: actionTypes.LOGIN_FAILURE,
          error: true,
          payload: new Error(getLoginErrorMessage()),
          meta: {source: actionSources[actionTypes.LOGIN_FAILURE]}
        }
      ];
      __Rewire__('services', {
        api: {
          user: {
            loginExtended: (creds, opts, cb) => cb(getLoginErrorMessage())
          }
        },
        localStore: {
          getItem: () => null,
          setItem: () => null
        }
      });
      const store = mockStore({
        working: {
          loggingIn: {
            inProgress: false
          }
        }
      });
      store.dispatch(async.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
      const actions = store.getActions();
      expect(actions[1].payload).to.deep.include({message:getLoginErrorMessage()});
      expectedActions[1].payload = actions[1].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogin [with no DSA error]', () => {
    test('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS, SET_BLIP_VIEW_DATA_URL, RETRIEVING_USERS_TARGETS, SET_PAGE (DataStorageCheck) actions', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123'}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [];
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_REQUEST,
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS,
          payload: {
            careTeam: [],
            dataDonationAccounts: [],
            patients: memberships,
          },
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_REQUEST
        },
        {
          type: actionTypes.LOGIN_SUCCESS,
          payload: {
            user: userObj.user,
            profile, memberships
          },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: {eventName: metrics.LOGIN_SUCCESS}
          }
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/no_upload_targets',
              state: {
                meta: {source: actionSources[actionTypes.SET_PAGE]}
              }
            } ],
            method: 'push'
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: [],
          }
        },
      ];
      __Rewire__('services', {
        api: {
          user: {
            loginExtended: (creds, opts, cb) => cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) => cb(null, {
              patients: memberships,
              dataDonationAccounts: [],
              careTeam: [],
            })
          },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          clinics: {
            getClinicsForClinician: (clinicianId, options, cb) => cb(null, []),
            getEHRSettings: (clinicId, cb) => cb(null, {}),
            getMRNSettings: (clinicId, cb) => cb(null, {}),
          }
        },
        log: _.noop,
        localStore: {
          getItem: () => null,
          setItem: () => null
        }
      });
      const store = mockStore({
        allUsers: {[userObj.user.userid]:userObj.user},
        uploadTargetUser: userObj.user.userid,
        targetUsersForUpload: [],
        working: {
          loggingIn: {
            inProgress: false
          }
        }
      });
      store.dispatch(async.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogin [verified clinic account]', () => {
    test('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS and SET_PAGE (CLINIC_USER_SELECT) actions', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_REQUEST
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS,
          payload: {
            careTeam: [],
            dataDonationAccounts: [],
            patients: memberships
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_REQUEST
        },
        {
          type: actionTypes.LOGIN_SUCCESS,
          payload: {
            user: userObj.user,
            profile, memberships
          },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: {eventName: metrics.CLINIC_LOGIN_SUCCESS}
          }
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/clinic_user_select',
              state: {
                meta: {
                  metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED},
                  source: actionSources.USER
                }
              }
            } ],
            method: 'push'
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: []
          }
        },
      ];
      __Rewire__('services', {
        api: {
          user: {
            loginExtended: (creds, opts, cb) => cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) => cb(null, {
              patients: memberships,
              dataDonationAccounts: [],
              careTeam: [],
            })
          },
          clinics: {
            getClinicsForClinician: (clinician, options, cb) => cb(null, []),
            getEHRSettings: (clinicId, cb) => cb(null, {}),
            getMRNSettings: (clinicId, cb) => cb(null, {}),
          }
        },
        log: _.noop
      });
      const store = mockStore({
        targetUsersForUpload: ['def456', 'ghi789'],
        working: {
          loggingIn: {
            inProgress: false
          }
        }
      });
      store.dispatch(async.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogin [new clinic account]', () => {
    test('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS and SET_PAGE (CLINIC_USER_SELECT) actions', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_REQUEST
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS,
          payload: {
            careTeam: [],
            dataDonationAccounts: [],
            patients: memberships
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_REQUEST
        },
        {
          type: actionTypes.LOGIN_SUCCESS,
          payload: {
            user: userObj.user,
            profile, memberships
          },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: {eventName: metrics.CLINIC_LOGIN_SUCCESS}
          }
        },
        {
          type: actionTypes.FETCH_PATIENTS_FOR_CLINIC_REQUEST
        },
        {
          type: actionTypes.FETCH_PATIENTS_FOR_CLINIC_SUCCESS,
          payload: {
            clinicId: 'clinicId',
            patients: [{ patient: 'patient1' }],
            count: 1,
          }
        },
        {
          type: actionTypes.SELECT_CLINIC,
          payload: {clinicId:'clinicId'}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/clinic_user_select',
              state: {
                meta: {
                  metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED},
                  source: actionSources.USER
                }
              }
            } ],
            method: 'push'
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: [{
              clinic: {
                id: 'clinicId'
              }
            }],
          },
        },
        {
          type: actionTypes.FETCH_CLINIC_EHR_SETTINGS_REQUEST,
        },
        {
          type: actionTypes.FETCH_CLINIC_EHR_SETTINGS_SUCCESS,
          payload: {
            clinicId: 'clinicId',
            settings: {},
          },
        },
        {
          type: actionTypes.FETCH_CLINIC_MRN_SETTINGS_REQUEST,
        },
        {
          type: actionTypes.FETCH_CLINIC_MRN_SETTINGS_SUCCESS,
          payload: {
            clinicId: 'clinicId',
            settings: {},
          },
        },
      ];
      __Rewire__('services', {
        api: {
          user: {
            loginExtended: (creds, opts, cb) =>
              cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) =>
              cb(null, {
                patients: memberships,
                dataDonationAccounts: [],
                careTeam: [],
              }),
          },
          clinics: {
            getClinicsForClinician: (clinician, options, cb) =>
              cb(null, [{ clinic: { id: 'clinicId' } }]),
            getPatientsForClinic: (clinicId, options, cb) =>
              cb(null, { data: [{ patient: 'patient1' }], meta: { count: 1 } }),
            getEHRSettings: (clinicId, cb) => cb(null, {}),
            getMRNSettings: (clinicId, cb) => cb(null, {}),
          },
        },
        log: _.noop,
      });
      const store = mockStore({
        targetUsersForUpload: ['def456', 'ghi789'],
        working: {
          loggingIn: {
            inProgress: false
          }
        }
      });
      store.dispatch(async.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogin [new clinic account] multiple clinics', () => {
    test('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS and SET_PAGE (WORKSPACE_SWITCH) actions', () => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_REQUEST
        },
        {
          type: actionTypes.FETCH_ASSOCIATED_ACCOUNTS_SUCCESS,
          payload: {
            careTeam: [],
            dataDonationAccounts: [],
            patients: memberships
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_REQUEST
        },
        {
          type: actionTypes.LOGIN_SUCCESS,
          payload: {
            user: userObj.user,
            profile, memberships
          },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: {eventName: metrics.CLINIC_LOGIN_SUCCESS}
          }
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/workspace_switch',
              state: {
                meta: {
                  metric: {eventName: metrics.WORKSPACE_SWITCH_DISPLAYED},
                  source: actionSources.USER
                }
              }
            } ],
            method: 'push'
          }
        },
        {
          type: actionTypes.GET_CLINICS_FOR_CLINICIAN_SUCCESS,
          payload: {
            clinicianId: 'abc123',
            clinics: [{
                clinic: {
                  id: 'clinicId'
                }
              },
              {
                clinic: {
                  id: 'clinicId2'
                }
              }
            ],
          },
        },
        {
          type: actionTypes.FETCH_CLINIC_EHR_SETTINGS_REQUEST,
        },
        {
          type: actionTypes.FETCH_CLINIC_EHR_SETTINGS_SUCCESS,
          payload: {
            clinicId: 'clinicId',
            settings: {},
          },
        },
        {
          type: actionTypes.FETCH_CLINIC_MRN_SETTINGS_REQUEST,
        },
        {
          type: actionTypes.FETCH_CLINIC_MRN_SETTINGS_SUCCESS,
          payload: {
            clinicId: 'clinicId',
            settings: {},
          },
        },
        {
          type: actionTypes.FETCH_CLINIC_EHR_SETTINGS_REQUEST,
        },
        {
          type: actionTypes.FETCH_CLINIC_EHR_SETTINGS_SUCCESS,
          payload: {
            clinicId: 'clinicId2',
            settings: {},
          },
        },
        {
          type: actionTypes.FETCH_CLINIC_MRN_SETTINGS_REQUEST,
        },
        {
          type: actionTypes.FETCH_CLINIC_MRN_SETTINGS_SUCCESS,
          payload: {
            clinicId: 'clinicId2',
            settings: {},
          },
        },
      ];
      __Rewire__('services', {
        api: {
          user: {
            loginExtended: (creds, opts, cb) =>
              cb(null, [userObj, profile, memberships]),
            getAssociatedAccounts: (cb) =>
              cb(null, {
                patients: memberships,
                dataDonationAccounts: [],
                careTeam: [],
              }),
          },
          clinics: {
            getClinicsForClinician: (clinician, options, cb) =>
              cb(null, [
                { clinic: { id: 'clinicId' } },
                { clinic: { id: 'clinicId2' } },
              ]),
            getPatientsForClinic: (clinicId, options, cb) =>
              cb(null, { data: [{ patient: 'patient1' }], meta: { count: 1 } }),
            getEHRSettings: (clinicId, cb) => cb(null, {}),
            getMRNSettings: (clinicId, cb) => cb(null, {}),
          },
        },
        log: _.noop,
      });
      const store = mockStore({
        targetUsersForUpload: ['def456', 'ghi789'],
        working: {
          loggingIn: {
            inProgress: false
          }
        }
      });
      store.dispatch(async.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogout [no error]', () => {
    test('should dispatch LOGOUT_REQUEST, LOGOUT_SUCCESS, SET_PAGE actions', () => {
      const expectedActions = [
        {
          type: actionTypes.LOGOUT_REQUEST,
          meta: {
            source: actionSources[actionTypes.LOGOUT_REQUEST],
            metric: {eventName: metrics.LOGOUT_REQUEST}
          }
        },
        {
          type: actionTypes.LOGOUT_SUCCESS,
          meta: {source: actionSources[actionTypes.LOGOUT_SUCCESS]}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/login',
              state: {
                meta: {source: actionSources.USER}
              }
            } ],
            method: 'push'
          }
        }
      ];
      __Rewire__('services', {
        api: {
          user: {
            logout: (cb) => cb(null)
          }
        }
      });
      const store = mockStore({keycloakConfig: {}});
      store.dispatch(async.doLogout());
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLogout [with error]', () => {
    test('should dispatch LOGOUT_REQUEST, LOGOUT_FAILURE, SET_PAGE actions', () => {
      const expectedActions = [
        {
          type: actionTypes.LOGOUT_REQUEST,
          meta: {
            source: actionSources[actionTypes.LOGOUT_REQUEST],
            metric: {eventName: metrics.LOGOUT_REQUEST}
          }
        },
        {
          type: actionTypes.LOGOUT_FAILURE,
          error: true,
          payload: new Error(getLogoutErrorMessage()),
          meta: {source: actionSources[actionTypes.LOGOUT_FAILURE]}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/login',
              state: {
                meta: {source: actionSources.USER}
              }
            } ],
            method: 'push'
          }
        }
      ];
      __Rewire__('services', {
        api: {
          user: {
            logout: (cb) => cb('Error :(')
          }
        }
      });
      const store = mockStore({keycloakConfig: {}});
      store.dispatch(async.doLogout());
      const actions = store.getActions();
      expect(actions[1].payload).to.deep.include({message:getLogoutErrorMessage()});
      expectedActions[1].payload = actions[1].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doLoggedOut', () => {
    test('should dispatch LOGOUT_REQUEST, LOGOUT_SUCCESS, SET_PAGE actions', () => {
      const expectedActions = [
        {
          type: actionTypes.LOGOUT_REQUEST,
          meta: {
            source: actionSources[actionTypes.LOGOUT_REQUEST],
            metric: {eventName: metrics.LOGOUT_REQUEST}
          }
        },
        {
          type: actionTypes.LOGOUT_SUCCESS,
          meta: {source: actionSources[actionTypes.LOGOUT_SUCCESS]}
        },
        {
          type: '@@router/CALL_HISTORY_METHOD',
          payload: {
            args: [ {
              pathname: '/logged_out',
              state: {
                meta: {source: actionSources.USER}
              }
            } ],
            method: 'push'
          }
        }
      ];
      __Rewire__('services', {
        api: {
          user: {
            logout: (cb) => cb(null)
          }
        }
      });
      const store = mockStore({keycloakConfig: {}});
      store.dispatch(async.doLoggedOut());
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [upload aborted b/c version check failed]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_FAILURE, UPLOAD_ABORTED', () => {
      const requiredVersion = '0.99.0';
      const currentVersion = '0.50.0';
      const time = '2016-01-01T12:05:00.123Z';
      const deviceKey = 'a_pump';
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: requiredVersion})
          }
        }
      });
      utilsRewireAPI.__Rewire__('osString', 'BeOS R5.1 (RISC-V)');
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
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
        },
        {
          type: actionTypes.UPLOAD_ABORTED,
          error: true,
          payload: new Error(ErrorMessages.E_UPLOAD_IN_PROGRESS),
          meta: {source: actionSources[actionTypes.UPLOAD_ABORTED]}
        }
      ];
      __Rewire__('versionInfo', {
        semver: currentVersion
      });
      const store = mockStore({});
      store.dispatch(async.doUpload(deviceKey, {}, time));
      const actions = store.getActions();
      expect(actions[1].payload).to.deep.include({message:(new UnsupportedError(currentVersion, requiredVersion)).message});
      expectedActions[1].payload = actions[1].payload;
      expect(actions[2].payload).to.deep.include({message:ErrorMessages.E_UPLOAD_IN_PROGRESS});
      expectedActions[2].payload = actions[2].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [upload aborted b/c another upload already in progress]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_ABORTED', () => {
      const initialState = {
        working: { uploading: { inProgress: true } },
      };
      const deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        }
      });
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.UPLOAD_ABORTED,
          error: true,
          payload: new Error(ErrorMessages.E_UPLOAD_IN_PROGRESS),
          meta: {source: actionSources[actionTypes.UPLOAD_ABORTED]}
        }
      ];
      __Rewire__('versionInfo', {
        semver: '0.100.0'
      });
      const store = mockStore(initialState);
      store.dispatch(async.doUpload(deviceKey,{}, time));
      const actions = store.getActions();
      expect(actions[2].payload).to.deep.include({message:ErrorMessages.E_UPLOAD_IN_PROGRESS});
      expectedActions[2].payload = actions[2].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [device, device detection error (serial)]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', () => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice,
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: { history: [{ start: time }] },
          },
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump'],
        },
        targetTimezones: {
          [userId]: 'US/Mountain',
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: { uploading: { inProgress: false } },
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_SERIAL_CONNECTION'
      };
      let err = new Error(ErrorMessages.E_SERIAL_CONNECTION);
      err.code = errProps.code;
      err.utc = errProps.utc;
      err.version = errProps.version;
      err.debug = `UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        device: {
          detect: (foo, bar, cb) => cb('Error :(')
        }
      });
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
              }
            }
          }
        },
        {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        },
        {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: 'Upload Failed',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState);
      store.dispatch(async.doUpload(deviceKey, {}, time));
      const actions = store.getActions();
      expect(actions[4].payload).to.deep.include({
        message: ErrorMessages.E_SERIAL_CONNECTION
      });
      expectedActions[4].payload = actions[4].payload;
      expectedActions[4].meta.metric.properties.error = actions[4].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [device, device detection error (hid)]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', () => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice,
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: { history: [{ start: time }] },
          },
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump'],
        },
        targetTimezones: {
          [userId]: 'US/Mountain',
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: { uploading: { inProgress: false } },
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_HID_CONNECTION'
      };
      let err = new Error(ErrorMessages.E_HID_CONNECTION);
      err.code = errProps.code;
      err.utc = errProps.utc;
      err.version = errProps.version;
      err.debug = `UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        device: {
          detect: (foo, bar, cb) => cb(null, null)
        }
      });
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
              }
            }
          }
        },
        {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        },
        {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: 'Upload Failed',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState);
      store.dispatch(async.doUpload(deviceKey, {}, time));
      const actions = store.getActions();
      expect(actions[4].payload).to.deep.include({
        message: ErrorMessages.E_HID_CONNECTION
      });
      expectedActions[4].payload = actions[4].payload;
      expectedActions[4].meta.metric.properties.error = actions[4].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [device, error during upload]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', () => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice,
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: { history: [{ start: time }] },
          },
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump'],
        },
        targetTimezones: {
          [userId]: 'US/Mountain',
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: { uploading: { inProgress: false } },
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_DEVICE_UPLOAD'
      };
      const basalErr = 'Problem processing basal!';
      let err = new Error(ErrorMessages.E_DEVICE_UPLOAD);
      err.details = basalErr;
      err.utc = errProps.utc;
      err.name = 'Error';
      err.code = errProps.code;
      err.version = errProps.version;
      err.debug = `Details: ${basalErr} | UTC Time: ${time} | Name: Error | Code: ${errProps.code} | Version: ${errProps.version}`;
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        device: {
          detect: (foo, bar, cb) => cb(null, {}),
          upload: (foo, bar, cb) => cb(basalErr)
        }
      });
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
              }
            }
          }
        },
        {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        },
        {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: 'Upload Failed',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState);
      store.dispatch(async.doUpload(deviceKey, {}, time));
      const actions = store.getActions();
      expect(actions[4].payload).to.deep.include({
        message: ErrorMessages.E_DEVICE_UPLOAD,
        details: err.details,
        name: err.name
      });
      expectedActions[4].payload = actions[4].payload;
      expectedActions[4].meta.metric.properties.error = actions[4].payload;
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [device, time check error and dialog dismissed]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', () => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice,
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: { history: [{ start: time }] },
          },
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump'],
        },
        targetTimezones: {
          [userId]: 'US/Mountain',
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: { uploading: { inProgress: false } },
      };
      let err = 'deviceTimePromptClose';
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        device: {
          detect: (foo, bar, cb) => cb(null, {}),
          upload: (foo, bar, cb) => cb(err)
        }
      });
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
              }
            }
          }
        },
        {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        },
        {
          type: actionTypes.UPLOAD_CANCELLED,
          payload: { utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_CANCELLED]
          }
        }
      ];
      const store = mockStore(initialState);
      store.dispatch(async.doUpload(deviceKey, {}, time));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('doUpload [no error]', () => {
    test('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_SUCCESS actions', () => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice,
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: { history: [{ start: time }] },
          },
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump'],
        },
        targetTimezones: {
          [userId]: 'US/Mountain',
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: { uploading: { inProgress: false } },
      };
      __Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        device: {
          detect: (foo, bar, cb) => cb(null, {}),
          upload: (foo, bar, cb) => cb(null, { post_records: [1,2,3,4,5], deviceModel: 'acme' })
        }
      });
      const expectedActions = [
        {
          type: actionTypes.VERSION_CHECK_REQUEST,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
        },
        {
          type: actionTypes.VERSION_CHECK_SUCCESS,
          meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
        },
        {
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
              }
            }
          }
        },
        {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        },
        {
          type: actionTypes.UPLOAD_SUCCESS,
          payload: { userId, deviceKey, utc: time, data: { deviceModel: 'acme', post_records: [1,2,3,4,5] } },
          meta: {
            source: actionSources[actionTypes.UPLOAD_SUCCESS],
            metric: {
              eventName: 'Upload Successful',
              properties: {
                type: targetDevice.source.type,
                deviceModel: 'acme',
                source: targetDevice.source.driverId,
                os: 'BeOS R5.1 (RISC-V)',
                started: time,
                finished: time,
                processed: 5
              }
            }
          }
        }
      ];
      const store = mockStore(initialState);
      store.dispatch(async.doUpload(deviceKey, {}, time));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('readFile', () => {
    describe('wrong file extension chosen', () => {
      test('should dispatch CHOOSING_FILE, READ_FILE_ABORTED actions', () => {
        const userId = 'abc123', deviceKey = 'a_pump', ext = '.abc', version = '0.100.0';
        let err = new Error(ErrorMessages.E_FILE_EXT + ext);
        err.code = 'E_FILE_EXT';
        err.version = version;
        err.debug = `Code: ${err.code} | Version: ${version}`;
        const expectedActions = [
          {
            type: actionTypes.CHOOSING_FILE,
            payload: { userId, deviceKey },
            meta: {source: actionSources[actionTypes.CHOOSING_FILE]}
          },
          {
            type: actionTypes.READ_FILE_ABORTED,
            error: true,
            payload: err,
            meta: {source: actionSources[actionTypes.READ_FILE_ABORTED]}
          }
        ];
        const state = {
          version: version
        };
        const store = mockStore(state);
        store.dispatch(async.readFile(userId, deviceKey, {name: 'data.csv'}, ext));
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({
          message: ErrorMessages.E_FILE_EXT + ext
        });
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('doVersionCheck', () => {
    describe('API error when attempting to get versions info from jellyfish', () => {
      test('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_FAILURE', () => {
        const err = new Error('API error!');
        const expectedActions = [
          {
            type: actionTypes.VERSION_CHECK_REQUEST,
            meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
          },
          {
            type: actionTypes.VERSION_CHECK_FAILURE,
            error: true,
            payload: err,
            meta: {
              source: actionSources[actionTypes.VERSION_CHECK_FAILURE],
              metric: {
                eventName: metrics.UNSUPPORTED_SCREEN_DISPLAYED
              }
            }
          }
        ];
        __Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(err); }
            }
          }
        });
        const store = mockStore({});
        store.dispatch(async.doVersionCheck());
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:'API error!'});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('missing or invalid semver in response from jellyfish', () => {
      test('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_FAILURE', () => {
        const err = new Error('Invalid semver [foo.bar]');
        const expectedActions = [
          {
            type: actionTypes.VERSION_CHECK_REQUEST,
            meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
          },
          {
            type: actionTypes.VERSION_CHECK_FAILURE,
            error: true,
            payload: err,
            meta: {
              source: actionSources[actionTypes.VERSION_CHECK_FAILURE],
              metric: {
                eventName: metrics.UNSUPPORTED_SCREEN_DISPLAYED
              }
            }
          }
        ];
        __Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(err); }
            }
          }
        });
        const store = mockStore({});
        store.dispatch(async.doVersionCheck());
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:'Invalid semver [foo.bar]'});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('uploader\'s version is below the required minimum', () => {
      test('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_FAILURE', () => {
        const currentVersion = '0.99.0', requiredVersion = '0.100.0';
        const err = new UnsupportedError(currentVersion, requiredVersion);
        const expectedActions = [
          {
            type: actionTypes.VERSION_CHECK_REQUEST,
            meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
          },
          {
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
          }
        ];
        __Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(null, {uploaderMinimum: requiredVersion}); }
            }
          }
        });
        __Rewire__('versionInfo', {
          semver: currentVersion
        });
        const store = mockStore({});
        store.dispatch(async.doVersionCheck());
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:err.message});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('uploader\'s version meets the minimum', () => {
      test('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_SUCCESS', () => {
        const currentVersion = '0.100.0', requiredVersion = '0.100.0';
        const expectedActions = [
          {
            type: actionTypes.VERSION_CHECK_REQUEST,
            meta: {source: actionSources[actionTypes.VERSION_CHECK_REQUEST]}
          },
          {
            type: actionTypes.VERSION_CHECK_SUCCESS,
            meta: {source: actionSources[actionTypes.VERSION_CHECK_SUCCESS]}
          }
        ];
        __Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(null, {uploaderMinimum: requiredVersion}); }
            }
          }
        });
        __Rewire__('versionInfo', {
          semver: currentVersion
        });
        const store = mockStore({});
        store.dispatch(async.doVersionCheck());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('clickDeviceSelectionDone', () => {
    describe('no targets in local storage', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (redirect to main page)', () => {
        const profile = {
          fullName: 'John',
          patient: {
            birthday: '1990-08-08'
          }
        };
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            }
          },
          localStore: {
            getItem: () => null,
            setItem: () => null
          }
        });
        const state = {
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123',
          allUsers: {
            abc123: profile
          }
        };
        const store = mockStore(state);
        store.dispatch(async.clickDeviceSelectionDone());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('existing targets in local storage', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (redirect to main page)', () => {
        const profile = {
          fullName: 'John',
          patient: {
            birthday: '1990-08-08'
          }
        };
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            }
          },
          localStore: {
            getItem: () => null,
            setItem: () => { return {
              abc123: [
                {key: 'a_pump', timezone: 'US/Central'}
              ],
              def456: [
                {key: 'a_pump', timezone: 'US/Eastern'},
                {key: 'a_cgm', timezone: 'US/Eastern'}
              ]
            }; },
            removeItem: (item) => null
          }
        });
        const state = {
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123',
          allUsers: {
            abc123: profile
          }
        };
        const store = mockStore(state);
        store.dispatch(async.clickDeviceSelectionDone());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('profile API endpoint failure', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_FAILURE, SET_PAGE (redirect to main page)', () => {
        const err = new Error(getUpdateProfileErrorMessage());
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_FAILURE,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_FAILURE]},
            payload: err,
            error: true
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                 state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(err);
              }
            }
          },
          localStore: {
            getItem: () => null,
            setItem: () => null
          }
        });
        const state = {
          allUsers: {
            abc123: {}
          },
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123'
        };
        const store = mockStore(state);
        store.dispatch(async.clickDeviceSelectionDone());
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:getUpdateProfileErrorMessage()});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('profile API endpoint failure (unauthorized)', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (redirect to main page)', () => {
        const profile = {
          fullName: 'John',
          patient: {
            birthday: '1990-08-08'
          }
        };
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb({status:401, body:null});
              }
            }
          },
          localStore: {
            getItem: () => null,
            setItem: () => null
          }
        });
        const state = {
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123',
          allUsers: {
            abc123: {profile}
          }
        };
        const store = mockStore(state);
        store.dispatch(async.clickDeviceSelectionDone());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('as new clinician account', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (redirect to main page)', () => {
        const profile = {
          fullName: 'John',
          patient: {
            birthday: '1990-08-08'
          }
        };
        const expectedActions = [
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_REQUEST,
          },
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_SUCCESS,
            payload: {
              clinicId: 'clinic1234',
              patient:{
                targetDevices: [
                  'a_pump', 'a_bg_meter'
                ],
              },
              patientId: 'abc123'
            },
          },
          {
            type: actionTypes.CLINIC_DEVICE_STORED,
            meta: {
              metric: {
                eventName: 'VCA Device Stored - a_pump'
              },
              source: actionSources[actionTypes.CLINIC_DEVICE_STORED]
            }
          },
          {
            type: actionTypes.CLINIC_DEVICE_STORED,
            meta: {
              metric: {
                eventName: 'VCA Device Stored - a_bg_meter'
              },
              source: actionSources[actionTypes.CLINIC_DEVICE_STORED]
            }
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {
                    source: actionSources[actionTypes.SET_PAGE],
                    metric: {
                      eventName: 'VCA Devices Done'
                    }
                  }
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            },
            clinics: {
              updateClinicPatient: (clinicId, patientId, patient, cb) => {
                cb(null, patient);
              }
            },
          },
          localStore: {
            getItem: () => null,
            setItem: () => null
          }
        });
        const state = {
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123',
          allUsers: {
            abc123: profile
          },
          selectedClinicId: 'clinic1234'
        };
        const store = mockStore(state);
        store.dispatch(async.clickDeviceSelectionDone());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('clickEditUserNext', () => {
    describe('update profile success, user has devices selected', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (main)', () => {
        const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
        const profile = {fullName: 'Jane Doe'};
        const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'def456', profile: {}},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              account: (cb) => cb(null, userObj.user),
              loggedInProfile: (cb) => cb(null, profile),
              getUploadGroups: (cb) => cb(null, memberships),
              updateProfile: (user, update, cb) => cb(null, {})
            }
          }
        });
        const state = {
          allUsers: {
            ghi789: {},
            abc123: {roles: ['clinic']},
            def456: {},
          },
          devices: {
            dexcom: {},
            omnipod: {}
          },
          targetDevices: {
            def456: ['dexcom']
          },
          users: {
            abc123: {
              targets: {}
            },
            def456: {
              targets: {
                devices: ['dexcom'],
                timezone: 'Europe/London'
              }
            }
          },
          loggedInUser: 'abc123',
          uploadTargetUser: 'def456'
        };
        const store = mockStore(state);
        store.dispatch(async.clickEditUserNext(profile));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('update profile success, user doesn\'t have devices selected', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (settings)', () => {
        const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
        const profile = {fullName: 'Jane Doe'};
        const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'def456', profile: {}},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              account: (cb) => cb(null, userObj.user),
              loggedInProfile: (cb) => cb(null, profile),
              getUploadGroups: (cb) => cb(null, memberships),
              updateProfile: (user, update, cb) => cb(null, {})
            }
          },
          log: _.noop
        });
        const state = {
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            dexcom: {},
            omnipod: {}
          },
          users: {
            abc123: {
              targets: {}
            },
            def456: {
              targets: {
                timezone: 'Europe/London'
              }
            }
          },
          uploadTargetUser: 'def456'
        };
        const store = mockStore(state);
        store.dispatch(async.clickEditUserNext(profile));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('update profile failure', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_FAILURE ', () => {
        const profile = {fullName: 'Jane Doe'};
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_FAILURE,
            payload: new Error(getUpdateProfileErrorMessage()),
            error: true,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_FAILURE]}
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              updateProfile: (user, update, cb) => cb('error')
            }
          },
          log: _.noop
        });

        const state = {
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          users: {
            abc123: {
              targets: {}
            },
            def456: {
              targets: {
                timezone: 'Europe/London'
              }
            }
          },
          uploadTargetUser: 'def456'
        };
        const store = mockStore(state);
        store.dispatch(async.clickEditUserNext(profile));
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:getUpdateProfileErrorMessage()});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('update profile failure, unauthorized', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_PAGE (settings) ', () => {
        const profile = {fullName: 'Jane Doe'};
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'def456', profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              updateProfile: (user, update, cb) => cb({status:401})
            }
          },
          log: _.noop
        });
        const store = mockStore({
          allUsers: {
            def456: {}
          },
          devices: {
            dexcom: {},
            omnipod: {}
          },
          uploadTargetUser:'def456'
        });
        store.dispatch(async.clickEditUserNext(profile));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('clickClinicEditUserNext', () => {
    describe('update profile success, user has devices selected', () => {
      test('should dispatch UPDATE_CLINIC_PATIENT_REQUEST, UPDATE_CLINIC_PATIENT_SUCCESS, SET_PAGE (main)', () => {
        const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
        const profile = {fullName: 'Jane Doe'};
        const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
        const selectedClinicId = 'clinicId789';
        const patientId = 'def456';
        const expectedActions = [
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_REQUEST,
          },
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_SUCCESS,
            payload: {
              clinicId: selectedClinicId,
              patient: profile,
              patientId
            },
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              account: (cb) => cb(null, userObj.user),
              loggedInProfile: (cb) => cb(null, profile),
              getUploadGroups: (cb) => cb(null, memberships),
              updateProfile: (user, update, cb) => cb(null, {})
            },
            clinics: {
              updateClinicPatient: (clinicId, patientId, patient, cb) => cb(null, patient)
            }
          }
        });
        const state = {
          allUsers: {
            ghi789: {},
            abc123: {roles: ['clinic']},
            def456: {},
          },
          devices: {
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          targetDevices: {
            def456: ['dexcom']
          },
          users: {
            abc123: {
              targets: {}
            },
            def456: {
              targets: {
                devices: ['dexcom'],
                timezone: 'Europe/London'
              }
            }
          },
          loggedInUser: 'abc123',
          uploadTargetUser: 'def456',
          selectedClinicId: 'clinicId789',
        };
        const store = mockStore(state);
        store.dispatch(async.clickClinicEditUserNext(selectedClinicId, patientId, profile));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('update profile success, user doesn\'t have devices selected', () => {
      test('should dispatch UPDATE_CLINIC_PATIENT_REQUEST, UPDATE_CLINIC_PATIENT_SUCCESS, SET_PAGE (settings)', () => {
        const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
        const profile = {fullName: 'Jane Doe'};
        const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
        const selectedClinicId = 'clinicId789';
        const patientId = 'def456';
        const expectedActions = [
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_REQUEST,
          },
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_SUCCESS,
            payload: {
              clinicId: selectedClinicId,
              patient: profile,
              patientId
            },
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              account: (cb) => cb(null, userObj.user),
              loggedInProfile: (cb) => cb(null, profile),
              getUploadGroups: (cb) => cb(null, memberships),
              updateProfile: (user, update, cb) => cb(null, {})
            },
            clinics: {
              updateClinicPatient: (clinicId, patientId, patient, cb) => cb(null, patient)
            }
          },
          log: _.noop
        });
        const state = {
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          users: {
            abc123: {
              targets: {}
            },
            def456: {
              targets: {
                timezone: 'Europe/London'
              }
            }
          },
          uploadTargetUser: 'def456',
          selectedClinicId: 'clinicId789',
        };
        const store = mockStore(state);
        store.dispatch(async.clickClinicEditUserNext(selectedClinicId, patientId, profile));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('update profile failure', () => {
      test('should dispatch UPDATE_CLINIC_PATIENT_REQUEST, UPDATE_CLINIC_PATIENT_FAILURE ', () => {
        const profile = {fullName: 'Jane Doe'};
        const selectedClinicId = 'clinicId789';
        const patientId = 'def456';
        const expectedActions = [
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_REQUEST,
          },
          {
            type: actionTypes.UPDATE_CLINIC_PATIENT_FAILURE,
            payload: new Error(getUpdateProfileErrorMessage()),
            error: true,
            meta: {apiError:null}
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              updateProfile: (user, update, cb) => cb('error')
            },
            clinics: {
              updateClinicPatient: (clinicId, patientId, patient, cb) => cb('error')
            }
          },
          log: _.noop
        });
        const store = mockStore({});
        store.dispatch(async.clickClinicEditUserNext(selectedClinicId, patientId, profile));
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:getUpdateProfileErrorMessage()});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('setTargetTimezone', () => {
    describe('update profile success', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_TARGET_TIMEZONE', () => {
        const profile = {
          fullName: 'John',
          patient: {
            birthday: '1990-08-08'
          }
        };
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: actionTypes.SET_TARGET_TIMEZONE,
            payload: {userId:'abc123',timezoneName:'US/Central'},
            meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]}
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            }
          }
        });
        const state = {
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123',
          allUsers: {
            abc123: profile
          }
        };
        const store = mockStore(state);
        store.dispatch(async.setTargetTimezone('abc123', 'US/Central'));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('update profile failure', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_FAILURE, SET_TARGET_TIMEZONE', () => {
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_FAILURE,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_FAILURE]},
            payload: new Error(getUpdateProfileErrorMessage()),
            error: true
          },
          {
            type: actionTypes.SET_TARGET_TIMEZONE,
            payload: {userId:'abc123',timezoneName:'US/Central'},
            meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]}
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(getUpdateProfileErrorMessage());
              }
            }
          }
        });
        const state = {
          allUsers: {
            abc123: {}
          },
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123'
        };
        const store = mockStore(state);
        store.dispatch(async.setTargetTimezone('abc123', 'US/Central'));
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:getUpdateProfileErrorMessage()});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('update profile failure (unauthorized)', () => {
      test('should dispatch UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, SET_TARGET_TIMEZONE', () => {
        const profile = {
          fullName: 'John',
          patient: {
            birthday: '1990-08-08'
          }
        };
        const expectedActions = [
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]},
          },
          {
            type: actionTypes.SET_TARGET_TIMEZONE,
            payload: {userId:'abc123',timezoneName:'US/Central'},
            meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]}
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb({status:401, body:null});
              }
            }
          }
        });
        const state = {
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123',
          allUsers: {
            abc123: {profile}
          }
        };
        const store = mockStore(state);
        store.dispatch(async.setTargetTimezone('abc123', 'US/Central'));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('retrieveTargetsFromStorage', () => {
    const url = 'http://acme-blip.com/patients/abc123/data';
    const blipUrlMaker = (path) => { return 'http://acme-blip.com' + path; };
    const profile = {
      fullName: 'John',
      patient: {
      birthday: '1990-08-08'
      }
    };
    describe('no targets retrieved from local storage, no targets exist in state', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_PAGE (redirect to settings page)', () => {
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          localStore: {
            getItem: () => null,
            removeItem: (item) => null
          }
        });
        const store = mockStore({allUsers: {'abc123':{}}});
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('no targets retrieved from local storage, targets exist in state but no user targeted for upload by default', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_PAGE (redirect to settings page for user selection)', () => {
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          localStore: {
            getItem: () => null,
            removeItem: (item) => null
          }
        });
        const state = {
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: null,
          targetDevices: {
            abc123: ['medtronic']
          }
        };
        const store = mockStore(state);
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('no targets retrieved from local storage, targets exist in state but user targeted has no supported devices', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_PAGE (redirect to settings page for device selection)', () => {
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker
          },
          localStore: {

          }
        });
        __Rewire__('localStore', {
          getItem: () => null,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('no targets retrieved from local storage, targets exist in state and user targeted for upload is all set to upload', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, then SET_PAGE (redirect to main page)', () => {
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker
          },
          localStore: {
            getItem: () => null,
            removeItem: (item) => null
          }
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('targets retrieved, but no user targeted for upload by default', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_USERS_TARGETS, SET_UPLOADS, then SET_PAGE (redirect to settings page for user selection)', () => {
        const targets = {
          abc123: [{key: 'medtronic', timezone: 'US/Eastern'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('localStore', {
          getItem: () => targets,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: null
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('targets retrieved, user targeted for upload is missing timezone', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, then SET_PAGE (redirect to main page for timezone selection)', () => {
        const targets = {
          abc123: [{key: 'medtronic'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]},
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            },
            makeBlipUrl: blipUrlMaker
          }
        });
        __Rewire__('localStore', {
          getItem: () => targets,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: profile,
            def456: {},
          },
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: {
            abc123: ['medtronic']
          },
          targetTimezones: {
            abc123: 'US/Mountain'
          }
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('targets retrieved, user targeted for upload is missing timezone, update profile unauthorized error', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, then SET_PAGE (redirect to main page for timezone selection)', () => {
        const targets = {
          abc123: [{key: 'medtronic'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb({status:401, body:null});
              }
            },
            makeBlipUrl: blipUrlMaker
          }
        });
        __Rewire__('localStore', {
          getItem: () => targets,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {profile},
            def456: {},
          },
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: {
            abc123: ['medtronic']
          },
          targetTimezones: {
            abc123: 'US/Mountain'
          }
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('targets retrieved, user targeted for upload has no supported devices', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, then SET_PAGE (redirect to settings page for device selection)', () => {
        const targets = {
          abc123: [{key: 'medtronic', timezone: 'US/Eastern'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker
          }
        });
        __Rewire__('localStore', {
          getItem: () => targets,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123'
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('targets retrieved, user targeted for upload is all set to upload', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, then SET_PAGE (redirect to main page)', () => {
        const targets = {
          abc123: [{key: 'medtronic', timezone: 'US/Eastern'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            },
            makeBlipUrl: blipUrlMaker
          }
        });
        __Rewire__('localStore', {
          getItem: () => targets,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: profile,
            def456: {},
          },
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser,
          targetTimezones: {
            abc123: 'US/Mountain'
          }
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('targets retrieved, user targeted for upload is all set to upload, update profile unauthorized error', () => {
      test('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, UPDATE_PROFILE_REQUEST, UPDATE_PROFILE_SUCCESS, then SET_PAGE (redirect to main page)', () => {
        const targets = {
          abc123: [{key: 'medtronic', timezone: 'US/Eastern'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['medtronic'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser },
            meta: {source: actionSources[actionTypes.SET_UPLOADS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_REQUEST,
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_REQUEST]}
          },
          {
            type: actionTypes.UPDATE_PROFILE_SUCCESS,
            payload: {userId: 'abc123', profile: profile},
            meta: {source: actionSources[actionTypes.UPDATE_PROFILE_SUCCESS]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb({status:401, body:null});
              }
            },
            makeBlipUrl: blipUrlMaker
          }
        });
        __Rewire__('localStore', {
          getItem: () => targets,
          removeItem: (item) => null
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {profile},
            def456: {},
          },
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser,
          targetTimezones: {
            abc123: 'US/Mountain'
          }
        });
        store.dispatch(async.retrieveTargetsFromStorage());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('goToPrivateWorkspace', () => {
    const blipUrlMaker = (path) => { return 'http://acme-blip.com' + path; };
    const profile = {
      fullName: 'John',
      patient: {
      birthday: '1990-08-08'
      }
    };
    describe('user is clinician account', () => {
      test('should dispatch SELECT_CLINIC, then SET_PAGE (redirect to clinic user select page)', () => {
        const targets = {
          abc123: [{key: 'carelink'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['carelink'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.SELECT_CLINIC,
            payload: { clinicId: null }
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/clinic_user_select',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              profile: (cb) => {
                cb(null);
              },
              updateProfile: (user, update, cb) => {
                cb(null, profile);
              }
            },
            makeBlipUrl: blipUrlMaker,
            metrics: {
              track: sinon.stub()
            },
          },
          localStore: {
            getItem: () => targets,
            removeItem: (item) => null
          }
        });
        const store = mockStore({
          allUsers: {
            ghi789: {isClinicMember: true},
            abc123: profile,
            def456: {},
          },
          devices: {
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: {
            abc123: ['carelink']
          },
          targetTimezones: {
            abc123: 'US/Mountain'
          }
        });
        store.dispatch(async.goToPrivateWorkspace());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('user is not clinician account', () => {
      test('should dispatch SELECT_CLINIC, then SET_PAGE (redirect to main page)', () => {
        const targets = {
          abc123: [{key: 'carelink', timezone: 'US/Eastern'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const devicesByUser = {
          abc123: ['carelink'],
          def456: ['dexcom', 'omnipod']
        };
        const expectedActions = [
          {
            type: actionTypes.SELECT_CLINIC,
            payload: { clinicId: null }
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker,
            metrics: {
              track: sinon.stub()
            },
          },
          localStore: {
            getItem: () => targets,
            removeItem: (item) => null
          }
        });
        const store = mockStore({
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {},
          },
          devices: {
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123'
        });
        store.dispatch(async.goToPrivateWorkspace());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('createCustodialAccount', () => {
    describe('create account success', () => {
      test('should dispatch CREATE_CUSTODIAL_ACCOUNT_REQUEST, CREATE_CUSTODIAL_ACCOUNT_SUCCESS, SET_UPLOAD_TARGET_USER, SET_PAGE (settings)', () => {
        const userObj = {user: {userid: 'abc123', roles: ['clinic']}};
        const profile = {fullName: 'Jane Doe', patient: { birthday: '2010-01-01' }};
        const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
        const newUser = { userid: 'jkl012', profile: profile };
        const expectedActions = [
          {
            type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST,
            meta: {source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST]}
          },
          {
            type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS,
            payload: {
              account: newUser
            },
            meta: {
              source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS],
              metric: {eventName: metrics.CLINIC_ADD_NEW_PATIENT}
            }
          },
          {
            type: actionTypes.SET_UPLOAD_TARGET_USER,
            payload: { userId: newUser.userid },
            meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              account: (cb) => cb(null, userObj.user),
              loggedInProfile: (cb) => cb(null, profile),
              getUploadGroups: (cb) => cb(null, memberships),
              createCustodialAccount: (profile, cb) => cb(null, newUser)
            }
          }
        });
        const store = mockStore({});
        store.dispatch(async.createCustodialAccount(profile));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('create account failure', () => {
      test('should dispatch CREATE_CUSTODIAL_ACCOUNT_REQUEST, CREATE_CUSTODIAL_ACCOUNT_FAILURE ', () => {
        const profile = {fullName: 'Jane Doe'};
        const expectedActions = [
          {
            type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST,
            meta: {source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST]}
          },
          {
            type: actionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE,
            payload: new Error(getCreateCustodialAccountErrorMessage()),
            error: true,
            meta: {source: actionSources[actionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE]}
          }
        ];
        __Rewire__('services', {
          api: {
            user: {
              createCustodialAccount: (profile, cb) => cb('error')
            }
          },
          log: _.noop
        });
        const store = mockStore({});
        store.dispatch(async.createCustodialAccount(profile));
        const actions = store.getActions();
        expect(actions[1].payload).to.deep.include({message:getCreateCustodialAccountErrorMessage()});
        expectedActions[1].payload = actions[1].payload;
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('setUploadTargetUserAndMaybeRedirect', () => {
    const userId = 'abc123', url = 'http://acme-blip.com/patients/abc123/data';
    const apiRewire = {
      api: {
      makeBlipUrl: (path) => { return 'http://acme-blip.com' + path; }
      }
    };
    describe('new target user has selected devices and timezone', () => {
      test('should dispatch just SET_UPLOAD_TARGET_USER and SET_BLIP_VIEW_DATA_URL', () => {
        const expectedActions = [
          {
            type: actionTypes.SET_UPLOAD_TARGET_USER,
            payload: { userId },
            meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
          },
          {
            type: actionTypes.SET_BLIP_VIEW_DATA_URL,
            payload: { url },
            meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
          }
        ];
        __Rewire__('services', apiRewire);
        const store = mockStore({
          devices: {
            a_pump: {}
          },
          targetDevices: {
            abc123: ['a_pump']
          },
          users: {
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          }
        });
        store.dispatch(async.setUploadTargetUserAndMaybeRedirect(userId));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('new target user has not selected devices', () => {
      test('should dispatch SET_UPLOAD_TARGET_USER, SET_BLIP_VIEW_DATA_URL, and SET_PAGE (redirect to settings)', () => {
        const expectedActions = [
          {
            type: actionTypes.SET_UPLOAD_TARGET_USER,
            payload: { userId },
            meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
          },
          {
            type: actionTypes.SET_BLIP_VIEW_DATA_URL,
            payload: { url },
            meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {source: actionSources[actionTypes.SET_PAGE]}
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', apiRewire);
        const store = mockStore({
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          users: {
            abc123: {
              targets: {
                timezone: 'Europe/London'
              }
            }
          }
        });
        store.dispatch(async.setUploadTargetUserAndMaybeRedirect(userId));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

    describe('new target user has not selected timezone', () => {
      test('should dispatch SET_UPLOAD_TARGET_USER, SET_BLIP_VIEW_DATA_URL', () => {
        const expectedActions = [
          {
            type: actionTypes.SET_UPLOAD_TARGET_USER,
            payload: { userId },
            meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
          },
          {
            type: actionTypes.SET_BLIP_VIEW_DATA_URL,
            payload: { url },
            meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
          }
        ];
        __Rewire__('services', apiRewire);
        const store = mockStore({
          devices: {
            medtronic: {},
            dexcom: {},
            omnipod: {}
          },
          targetDevices: {
            abc123: ['medtronic']
          },
          users: {
            abc123: {
              targets: {
                devices: ['medtronic']
              }
            }
          }
        });
        store.dispatch(async.setUploadTargetUserAndMaybeRedirect(userId));
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('checkUploadTargetUserAndMaybeRedirect', () => {
    const userId = 'abc123';
    describe('target user has selected devices', () => {
      test('should dispatch SET_PAGE (main)', () => {
        const expectedActions = [
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {
                    source: actionSources[actionTypes.SET_PAGE],
                    metric: {eventName: metrics.CLINIC_NEXT}
                  }
                }
              } ],
              method: 'push'
            }
          }
        ];
        const store = mockStore({
          loggedInUser: 'def456',
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {roles: ['clinic']},
          },
          targetDevices: {
            abc123: ['a_pump']
          },
          devices: {
            a_pump: true
          },
          users: {
            def456: {},
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          },
          uploadTargetUser: 'abc123'
        });
        store.dispatch(async.checkUploadTargetUserAndMaybeRedirect());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('target user has not selected devices', () => {
      test('should dispatch SET_PAGE (settings)', () => {
        const expectedActions = [
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {
                    source: actionSources[actionTypes.SET_PAGE],
                    metric: {eventName: metrics.CLINIC_NEXT}
                  }
                }
              } ],
              method: 'push'
            }
          }
        ];
        const store = mockStore({
          loggedInUser: 'def456',
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {roles: ['clinic']},
          },
          targetDevices: {
            abc123: []
          },
          devices: {
            a_pump: true
          },
          users: {
            def456: {},
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          },
          uploadTargetUser: 'abc123'
        });
        store.dispatch(async.checkUploadTargetUserAndMaybeRedirect());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('no target user selected', () => {
      test('should dispatch no actions', () => {
        const expectedActions = [];
        const store = mockStore({
          loggedInUser: 'def456',
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {roles: ['clinic']},
          },
          targetDevices: {
            abc123: []
          },
          devices: {
            a_pump: true
          },
          users: {
            def456: {},
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          }
        });
        store.dispatch(async.checkUploadTargetUserAndMaybeRedirect());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('new clinic target user has selected devices', () => {
      test('should dispatch SET_PAGE (main)', () => {
        const expectedActions = [
          {
            type: actionTypes.FETCH_PATIENT_REQUEST
          },
          {
            type: actionTypes.FETCH_PATIENT_SUCCESS,
            payload: {
              patient: {
                id: 'abc123'
              }
            }
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/main',
                state: {
                  meta: {
                    source: actionSources[actionTypes.SET_PAGE],
                    metric: {eventName: metrics.CLINIC_NEXT}
                  }
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            patient: {
              get: (id, cb) => cb(null, {id: 'abc123'})
            }
          },
          log: _.noop
        });
        const store = mockStore({
          loggedInUser: 'def456',
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {roles: ['clinic']},
          },
          targetDevices: {
            abc123: ['a_pump']
          },
          devices: {
            a_pump: true
          },
          users: {
            def456: {},
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          },
          clinics:{
            clinic123: {
              patients: {
                abc123: {
                  targetDevices: ['a_pump']
                }
              }
            }
          },
          uploadTargetUser: 'abc123',
          selectedClinicId: 'clinic123',
        });
        store.dispatch(async.checkUploadTargetUserAndMaybeRedirect());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
    describe('new clinic target user has not selected devices', () => {
      test('should dispatch SET_PAGE (settings)', () => {
        const expectedActions = [
          {
            type: actionTypes.FETCH_PATIENT_REQUEST
          },
          {
            type: actionTypes.FETCH_PATIENT_SUCCESS,
            payload: {
              patient: {
                id: 'abc123'
              }
            }
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [ {
                pathname: '/settings',
                state: {
                  meta: {
                    source: actionSources[actionTypes.SET_PAGE],
                    metric: {eventName: metrics.CLINIC_NEXT}
                  }
                }
              } ],
              method: 'push'
            }
          }
        ];
        __Rewire__('services', {
          api: {
            patient: {
              get: (id, cb) => cb(null, {id: 'abc123'})
            }
          },
          log: _.noop
        });
        const store = mockStore({
          loggedInUser: 'def456',
          allUsers: {
            ghi789: {},
            abc123: {},
            def456: {roles: ['clinic']},
          },
          targetDevices: {
            abc123: []
          },
          devices: {
            a_pump: true
          },
          users: {
            def456: {},
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          },
          uploadTargetUser: 'abc123',
          selectedClinicId: 'clinic123'
        });
        store.dispatch(async.checkUploadTargetUserAndMaybeRedirect());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });

  });

  describe('clickAddNewUser', () => {
    describe('link clicked', () => {
      test('should dispatch SET_UPLOAD_TARGET_USER and SET_PAGE (CLINIC_USER_EDIT)', () => {
        const expectedActions = [
          {
            type: actionTypes.SET_UPLOAD_TARGET_USER,
            payload: { userId: null },
            meta: {source: actionSources[actionTypes.SET_UPLOAD_TARGET_USER]}
          },
          {
            type: '@@router/CALL_HISTORY_METHOD',
            payload: {
              args: [  {
                'pathname': '/clinic_user_edit',
                'state': {
                  'meta': {
                    'metric': {
                      'eventName': metrics.CLINIC_ADD
                    },
                    'source': actionSources[actionTypes.SET_PAGE]
                  }
                }
              } ],
              method: 'push'
            }
          }
        ];
        const store = mockStore({});
        store.dispatch(async.clickAddNewUser());
        const actions = store.getActions();
        expect(actions).to.deep.equal(expectedActions);
      });
    });
  });

  describe('setPage', () => {
    const PAGE = pages.MAIN;

    test('should create an action to set the page', () => {
      const expectedActions = [{
        type: '@@router/CALL_HISTORY_METHOD',
        payload: {
          args: [ {
            pathname: '/main',
            state: {
              meta: {source: actionSources[actionTypes.SET_PAGE]}
            }
          } ],
          method: 'push'
        }
      }];
      const store = mockStore({});
      store.dispatch(async.setPage(PAGE));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });

    test('should accept a second parameter to override the default action source', () => {
      const expectedActions = [{
        type: '@@router/CALL_HISTORY_METHOD',
        payload: {
          args: [ {
            pathname: '/main',
            state: {
              meta: {source: actionSources.USER}
            }
          } ],
          method: 'push'
        }
      }];
      const store = mockStore({});
      store.dispatch(async.setPage(PAGE, actionSources.USER));
      const actions = store.getActions();
      expect(actions).to.deep.equal(expectedActions);
    });
  });

  describe('fetchPatient', () => {
    test('should trigger FETCH_PATIENT_SUCCESS for a successful request', () => {
      let patient = { id: 58686, name: 'Buddy Holly', age: 65 };

      let api = {
        patient: {
          get: sinon.stub().callsArgWith(1, null, patient)
        }
      };

      let expectedActions = [
        { type: 'FETCH_PATIENT_REQUEST' },
        { type: 'FETCH_PATIENT_SUCCESS', payload: { patient : patient } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.fetchPatient(api, 58686));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
      expect(api.patient.get.withArgs(58686).callCount).to.equal(1);
    });

    test('should trigger FETCH_PATIENT_SUCCESS without fetching patient if complete patient record is in cache', () => {
      let patient = { id: 58686, name: 'Buddy Holly', age: 65, settings: {} };

      let api = {
        patient: {
          get: sinon.stub().callsArgWith(1, null, patient)
        }
      };

      let expectedActions = [
        { type: 'FETCH_PATIENT_SUCCESS', payload: { patient : patient } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore({
        ...initialState,
        allUsers: {
          58686: patient,
          '58686_cacheUntil': 9999999999999,
        }
      });
      store.dispatch(async.fetchPatient(api, 58686));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
      expect(api.patient.get.callCount).to.equal(0);
    });

    test('should skip the cache and fetch patient if settings are missing in cached patient record', () => {
      let patient = { id: 58686, name: 'Buddy Holly', age: 65, settings: undefined };

      let api = {
        patient: {
          get: sinon.stub().callsArgWith(1, null, patient)
        }
      };

      let expectedActions = [
        { type: 'FETCH_PATIENT_REQUEST' },
        { type: 'FETCH_PATIENT_SUCCESS', payload: { patient : patient } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore({
        ...initialState,
        allUsers: {
          58686: patient,
          '58686_cacheUntil': 9999999999999,
        }
      });
      store.dispatch(async.fetchPatient(api, 58686));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
      expect(api.patient.get.withArgs(58686).callCount).to.equal(1);
    });

    test('[500] should trigger FETCH_PATIENT_FAILURE and it should call error once for a failed request', () => {
      let patient = { id: 58686, name: 'Buddy Holly', age: 65 };

      let api = {
        patient: {
          get: sinon.stub().callsArgWith(1, {status: 500, body: 'Error!'}, null)
        }
      };

      let err = new Error(ErrorMessages.ERR_FETCHING_PATIENT);
      err.status = 500;

      let expectedActions = [
        { type: 'FETCH_PATIENT_REQUEST' },
        { type: 'FETCH_PATIENT_FAILURE', error: err, payload: {link: null}, meta: { apiError: {status: 500, body: 'Error!'} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.fetchPatient(api, 58686));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message: ErrorMessages.ERR_FETCHING_PATIENT });
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
      expect(api.patient.get.withArgs(58686).callCount).to.equal(1);
    });

    test('[404] should trigger FETCH_PATIENT_FAILURE and it should call error once for a failed request', () => {
      let patient = { id: 58686, name: 'Buddy Holly', age: 65 };
      let thisInitialState = Object.assign(initialState, {loggedInUserId: 58686});

      let api = {
        patient: {
          get: sinon.stub().callsArgWith(1, {status: 404, body: 'Error!'}, null)
        }
      };

      let err = new Error(ErrorMessages.ERR_YOUR_ACCOUNT_NOT_CONFIGURED);
      err.status = 404;

      let expectedActions = [
        { type: 'FETCH_PATIENT_REQUEST' },
        { type: 'FETCH_PATIENT_FAILURE', error: err, payload: {link: null}, meta: { apiError: {status: 404, body: 'Error!'} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(thisInitialState);
      store.dispatch(async.fetchPatient(api, 58686));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message: ErrorMessages.ERR_YOUR_ACCOUNT_NOT_CONFIGURED });
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
      expect(api.patient.get.withArgs(58686).callCount).to.equal(1);
    });
  });

  describe('fetchAssociatedAccounts', () => {
    test('should trigger FETCH_ASSOCIATED_ACCOUNTS_SUCCESS for a successful request', () => {
      let patients = [
        { id: 58686, name: 'Buddy Holly', age: 65 }
      ];

      let api = {
        user: {
          getAssociatedAccounts: sinon.stub().callsArgWith(0, null, { patients })
        }
      };

      let expectedActions = [
        { type: 'FETCH_ASSOCIATED_ACCOUNTS_REQUEST' },
        { type: 'FETCH_ASSOCIATED_ACCOUNTS_SUCCESS', payload: { patients : patients } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.fetchAssociatedAccounts(api));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
      expect(api.user.getAssociatedAccounts.callCount).to.equal(1);
    });

    test('should trigger FETCH_ASSOCIATED_ACCOUNTS_FAILURE and it should call error once for a failed request', () => {
      let patients = [
        { id: 58686, name: 'Buddy Holly', age: 65 }
      ];

      let api = {
        user: {
          getAssociatedAccounts: sinon.stub().callsArgWith(0, {status: 500, body: {status: 500, body: 'Error!'}}, null)
        }
      };

      let err = new Error(ErrorMessages.ERR_FETCHING_ASSOCIATED_ACCOUNTS);
      err.status = 500;

      let expectedActions = [
        { type: 'FETCH_ASSOCIATED_ACCOUNTS_REQUEST' },
        { type: 'FETCH_ASSOCIATED_ACCOUNTS_FAILURE', error: err, meta: { apiError: {status: 500, body: {status: 500, body: 'Error!'}} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.fetchAssociatedAccounts(api));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message: ErrorMessages.ERR_FETCHING_ASSOCIATED_ACCOUNTS });
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
      expect(api.user.getAssociatedAccounts.callCount).to.equal(1);
    });
  });

  describe('fetchPatientsForClinic', () => {
    test('should trigger FETCH_PATIENTS_FOR_CLINIC_SUCCESS and it should call clinics.getPatientsForClinic once for a successful request', () => {
      let patients = [{
        clinicId: '5f85fbe6686e6bb9170ab5d0',
        patientId: 'patient_id',
        id: 'relationship_id',
      }];

      __Rewire__('services', {
        api: {
          clinics: {
            getPatientsForClinic: sinon.stub().callsArgWith(2, null, {data:[{patient:'patient1'}],meta:{count:1}}  ),
          },
        },
      });

      let expectedActions = [
        { type: 'FETCH_PATIENTS_FOR_CLINIC_REQUEST' },
        {
          type: 'FETCH_PATIENTS_FOR_CLINIC_SUCCESS',
          payload: {
            clinicId: '5f85fbe6686e6bb9170ab5d0',
            patients: [{ patient: 'patient1' }],
            count: 1,
          },
        },
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });

      let store = mockStore(initialState);
      store.dispatch(async.fetchPatientsForClinic('5f85fbe6686e6bb9170ab5d0'));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
    });

    test('should trigger FETCH_PATIENTS_FOR_CLINIC_FAILURE and it should call error once for a failed request', () => {
      __Rewire__('services', {
        api: {
          clinics: {
            getPatientsForClinic: sinon.stub().callsArgWith(2, {status: 500, body: 'Error!'}, null),
          },
        },
      });

      let err = new Error(ErrorMessages.ERR_FETCHING_PATIENTS_FOR_CLINIC);
      err.status = 500;

      let expectedActions = [
        { type: 'FETCH_PATIENTS_FOR_CLINIC_REQUEST' },
        { type: 'FETCH_PATIENTS_FOR_CLINIC_FAILURE', error: err, meta: { apiError: {status: 500, body: 'Error!'} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.fetchPatientsForClinic('5f85fbe6686e6bb9170ab5d0'));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message: ErrorMessages.ERR_FETCHING_PATIENTS_FOR_CLINIC });
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
    });
  });

  describe('createClinicCustodialAccount', () => {
    test('should trigger CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS and it should call clinics.createCustodialAccount once for a successful request', () => {
      let patientUserId = 'patient_userId';
      let clinicId = '5f85fbe6686e6bb9170ab5d0';

      __Rewire__('services', {
        api: {
          clinics: {
            createClinicCustodialAccount: sinon.stub().callsArgWith(2, null, {
              id: patientUserId,
            } ),
          },
        },
        log: _.noop
      });

      let expectedActions = [
        { type: 'CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST' },
        { type: 'CREATE_CLINIC_CUSTODIAL_ACCOUNT_SUCCESS',
          payload: {
            clinicId,
            patientId: patientUserId,
            patient: { id: patientUserId }
          },
          meta: {
            metric: { eventName: 'VCA Add New Patient Saved' },
            source: 'UNDER_THE_HOOD',
          }
        },
        { type: 'SET_UPLOAD_TARGET_USER', payload: {
          userId: patientUserId
        }, meta: {source: 'USER'}},
        { type: '@@router/CALL_HISTORY_METHOD', payload: {
          args: [{pathname: '/settings', state: { meta: { source: 'USER_VISIBLE'}}}],
          method: 'push'
        }}
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });

      let store = mockStore(initialState);
      store.dispatch(async.createClinicCustodialAccount(clinicId, { id: patientUserId }));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
    });

    test('should trigger CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE and it should call error once for a failed request', () => {
      __Rewire__('services', {
        api: {
          clinics: {
            createClinicCustodialAccount: sinon.stub().callsArgWith(2, {status: 500, body: 'Error!'}, null),
          },
        },
        log: _.noop
      });

      let err = new Error(ErrorMessages.ERR_CREATING_CUSTODIAL_ACCOUNT);
      err.status = 500;

      let expectedActions = [
        { type: 'CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST' },
        { type: 'CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE', error: err, meta: { apiError: {status: 500, body: 'Error!'} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.createClinicCustodialAccount('5f85fbe6686e6bb9170ab5d0'));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message: getCreateCustodialAccountErrorMessage(500) });
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
    });

    test('should trigger CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE and it should call error once for a duplicate email address', () => {
      __Rewire__('services', {
        api: {
          clinics: {
            createClinicCustodialAccount: sinon.stub().callsArgWith(2, {status: 409, body: 'Error!'}, null),
          },
        },
        log: _.noop
      });

      let err = new Error(getCreateCustodialAccountErrorMessage(409));
      err.status = 409;

      let expectedActions = [
        { type: 'CREATE_CLINIC_CUSTODIAL_ACCOUNT_REQUEST' },
        { type: 'CREATE_CLINIC_CUSTODIAL_ACCOUNT_FAILURE', error: err, meta: { apiError: {status: 409, body: 'Error!'} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.createClinicCustodialAccount('5f85fbe6686e6bb9170ab5d0'));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message:  getCreateCustodialAccountErrorMessage(409)});
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
    });
  });

  describe('getClinicsForClinician', () => {
    test('should trigger GET_CLINICS_FOR_CLINICIAN_SUCCESS and it should call clinics.getClinicsForClinician once for a successful request', () => {
      let clinicianId = 'clinicianId1';
      let clinics = [{
        clinic: {
          id: '5f85fbe6686e6bb9170ab5d0',
          address: '1 Address Ln, City Zip',
          name: 'Clinic1',
          phoneNumbers: [{ number: '(888) 555-5555', type: 'Office' }],
        },
      }];

      let api = {
        clinics: {
          getClinicsForClinician: sinon.stub().callsArgWith(2, null, clinics),
          getEHRSettings: sinon.stub().callsArgWith(1, null, {}),
          getMRNSettings: sinon.stub().callsArgWith(1, null, {}),
        },
      };

      let expectedActions = [
        { type: 'GET_CLINICS_FOR_CLINICIAN_REQUEST' },
        {
          type: 'GET_CLINICS_FOR_CLINICIAN_SUCCESS',
          payload: {
            clinicianId: clinicianId,
            clinics: clinics
          },
        },
        {
          type: 'FETCH_CLINIC_EHR_SETTINGS_REQUEST',
        },
        {
          type: 'FETCH_CLINIC_EHR_SETTINGS_SUCCESS',
          payload: {
            clinicId: '5f85fbe6686e6bb9170ab5d0',
            settings: {},
          },
        },
        {
          type: 'FETCH_CLINIC_MRN_SETTINGS_REQUEST',
        },
        {
          type: 'FETCH_CLINIC_MRN_SETTINGS_SUCCESS',
          payload: {
            clinicId: '5f85fbe6686e6bb9170ab5d0',
            settings: {},
          },
        },
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });

      let store = mockStore(initialState);
      store.dispatch(async.getClinicsForClinician(api, clinicianId));

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
      expect(api.clinics.getClinicsForClinician.callCount).to.equal(1);
    });

    test('should trigger GET_CLINICS_FOR_CLINICIAN_FAILURE and it should call error once for a failed request', () => {
      let clinicianId = 'clinicianId1';
      let api = {
        clinics: {
          getClinicsForClinician: sinon.stub().callsArgWith(2, {status: 500, body: 'Error!'}, null),
        },
      };

      let err = new Error(ErrorMessages.ERR_FETCHING_CLINICS_FOR_CLINICIAN);
      err.status = 500;

      let expectedActions = [
        { type: 'GET_CLINICS_FOR_CLINICIAN_REQUEST' },
        { type: 'GET_CLINICS_FOR_CLINICIAN_FAILURE', error: err, meta: { apiError: {status: 500, body: 'Error!'} } }
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(async.getClinicsForClinician(api, clinicianId));

      const actions = store.getActions();
      expect(actions[1].error).to.deep.include({ message: ErrorMessages.ERR_FETCHING_CLINICS_FOR_CLINICIAN });
      expectedActions[1].error = actions[1].error;
      expect(actions).to.eql(expectedActions);
      expect(api.clinics.getClinicsForClinician.callCount).to.equal(1);
    });
  });

  describe('fetchInfo', () => {
    it('should trigger FETCH_INFO_SUCCESS and it should call server.getInfo once for a successful request', () => {
      const info = {
        auth: {
          url: 'someUrl',
          realm: 'awesomeRealm',
        }
      };

      __Rewire__('services', {
        api: {
          upload: {
            getInfo: sinon.stub().callsArgWith(0, null, info),
          },
        },
      });

      let expectedActions = [
        { type: 'FETCH_INFO_REQUEST',  meta: {source: actionSources[actionTypes.FETCH_INFO_REQUEST]} },
        {
          type: 'FETCH_INFO_SUCCESS',
          payload: { info },
          meta: {source: actionSources[actionTypes.FETCH_INFO_SUCCESS]}
        },
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });

      let store = mockStore(initialState);
      store.dispatch(
        async.fetchInfo()
      );

      const actions = store.getActions();
      expect(actions).to.eql(expectedActions);
    });

    it('should trigger FETCH_INFO_FAILURE and it should call error once for a failed request', () => {

      __Rewire__('services', {
        api: {
          upload: {
            getInfo: sinon
            .stub()
            .callsArgWith(0, { status: 500, body: 'Error!' }, null),
          },
        },
      });

      let err = new Error(ErrorMessages.ERR_FETCHING_INFO);
      err.status = 500;

      let expectedActions = [
        { type: 'FETCH_INFO_REQUEST',  meta: {source: actionSources[actionTypes.FETCH_INFO_REQUEST]} },
        {
          type: 'FETCH_INFO_FAILURE',
          error: true,
          payload: err,
          meta: { source: actionSources[actionTypes.FETCH_INFO_FAILURE] },
        },
      ];
      _.each(expectedActions, (action) => {
        expect(isFSA(action)).to.be.true;
      });
      let store = mockStore(initialState);
      store.dispatch(
        async.fetchInfo()
      );

      const actions = store.getActions();
      expect(actions[1].payload).to.deep.include({
        message: ErrorMessages.ERR_FETCHING_INFO,
      });
      expectedActions[1].payload = actions[1].payload;
      expect(actions).to.eql(expectedActions);
    });
  });

});
