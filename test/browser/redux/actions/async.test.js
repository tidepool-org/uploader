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

import _ from 'lodash';
import { isFSA } from 'flux-standard-action';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import * as actionSources from '../../../../lib/redux/constants/actionSources';
import * as actionTypes from '../../../../lib/redux/constants/actionTypes';
import * as metrics from '../../../../lib/redux/constants/metrics';
import { pages } from '../../../../lib/redux/constants/otherConstants';

import * as asyncActions from '../../../../lib/redux/actions/async';
import { getLoginErrorMessage } from '../../../../lib/redux/utils/errors';

let pwd = require('../../fixtures/pwd.json');
let nonpwd = require('../../fixtures/nonpwd.json');

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

global.chrome = {
  contextMenus: {
    removeAll: _.noop
  },
  runtime: {
    getManifest: function() { return {permissions: [{usbDevices: [{driverId: '12345'}]}]}; },
    getPlatformInfo: function(cb) { return cb({os: 'test'}); }
  }
};

describe('Asynchronous Actions', () => {
  afterEach(function() {
    // very important to do this in an afterEach than in each test when __Rewire__ is used
    // if you try to reset within each test you'll make it impossible for tests to fail!
    asyncActions.__ResetDependency__('services');
  });

  describe('doAppInit [no session token in local storage]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_PAGE, INIT_APP_SUCCESS actions', (done) => {
      const config = {
        version: '0.100.0',
        API_URL: 'http://www.acme.com'
      };
      const servicesToInit = {
        api: {
          init: (cb) => { cb(); },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com' + path;
          },
          setHosts: _.noop
        },
        carelink: {
          init: (opts, cb) => { cb(); }
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
          type: actionTypes.SET_VERSION,
          payload: {version: '0.100.0'},
          meta: {source: actionSources[actionTypes.SET_VERSION]}
        },
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.SET_OS,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.SET_OS]}
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
          type: actionTypes.SET_PAGE,
          payload: {page: pages.LOGIN},
          meta: {source: actionSources[actionTypes.SET_PAGE]}
        },
        {
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        }
      ];
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doAppInit(config, servicesToInit));
    });
  });

  describe('doAppInit [with session token in local storage]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, INIT_APP_SUCCESS, SET_USER_INFO_FROM_TOKEN actions', (done) => {
      const config = {
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
          user: {
            account: (cb) => { cb(null, pwd.user); },
            profile: (cb) => { cb(null, pwd.profile); },
            getUploadGroups: (cb) => { cb(null, pwd.memberships); }
          }
        },
        carelink: {
          init: (opts, cb) => { cb(); }
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
          type: actionTypes.SET_VERSION,
          payload: {version: '0.100.0'},
          meta: {source: actionSources[actionTypes.SET_VERSION]}
        },
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.SET_OS,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.SET_OS]}
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
          type: actionTypes.INIT_APP_SUCCESS,
          meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
        },
        {
          type: actionTypes.SET_USER_INFO_FROM_TOKEN,
          payload: {user: pwd.user, profile: pwd.profile, memberships: pwd.memberships},
          meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
        }
      ];
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doAppInit(config, servicesToInit));
    });
  });

  describe('doAppInit [with error in api init]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, INIT_APP_FAILURE actions', (done) => {
      const config = {
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
        carelink: {
          init: (opts, cb) => { cb(); }
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
          type: actionTypes.SET_VERSION,
          payload: {version: '0.100.0'},
          meta: {source: actionSources[actionTypes.SET_VERSION]}
        },
        {
          type: actionTypes.INIT_APP_REQUEST,
          meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
        },
        {
          type: actionTypes.SET_OS,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.SET_OS]}
        },
        {
          type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
          payload: {os: 'test'},
          meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
        },
        {
          type: actionTypes.INIT_APP_FAILURE,
          error: true,
          payload: new Error('Error during app initialization.'),
          meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
        }
      ];
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doAppInit(config, servicesToInit));
    });
  });

  describe('doLogin [no error]', () => {
    it('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS, SET_PAGE actions', (done) => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123'}};
      const profile = {fullName: 'Jane Doe'};
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}];
      const expectedActions = [
        {
          type: actionTypes.LOGIN_REQUEST,
          meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
        },
        {
          type: actionTypes.LOGIN_SUCCESS,
          payload: {
            user: userObj.user,
            profile, memberships
          },
          meta: {
            source: actionSources[actionTypes.LOGIN_SUCCESS],
            metric: metrics.LOGIN_SUCCESS
          }
        }
      ];
      asyncActions.__Rewire__('services', {
        api: {
          user: {
            login: (creds, opts, cb) => cb(null, userObj),
            profile: (cb) => cb(null, profile),
            getUploadGroups: (cb) => cb(null, memberships)
          }
        },
        log: _.noop
      });
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
    });
  });

  describe('doLogin [with error]', () => {
    it('should dispatch LOGIN_REQUEST, LOGIN_FAILURE actions', (done) => {
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
      asyncActions.__Rewire__('services', {
        api: {
          user: {
            login: (creds, opts, cb) => cb(getLoginErrorMessage()),
            getUploadGroups: (cb) => cb(null, [])
          }
        }
      });
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ));
    });
  });

  describe('putUsersTargetsInStorage', () => {
    describe('no targets in local storage', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, STORING_USERS_TARGETS, SET_PAGE (redirect to main page)', (done) => {
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.STORING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.STORING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_PAGE,
            payload: {page: pages.MAIN},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          localStore: {
            getItem: () => null,
            setItem: () => null
          }
        });
        const state = {
          users: {
            abc123: {
              targets: {
                devices: ['a_pump', 'a_bg_meter'],
                timezone: 'Europe/Budapest'
              }
            },
            uploadTargetUser: 'abc123'
          }
        };
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.putTargetsInStorage());
      });
    });

    describe('existing targets in local storage', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, STORING_USERS_TARGETS, SET_PAGE (redirect to main page)', (done) => {
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.STORING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.STORING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_PAGE,
            payload: {page: pages.MAIN},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
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
            }; }
          }
        });
        const state = {
          users: {
            abc123: {
              targets: {
                devices: ['a_pump', 'a_bg_meter'],
                timezone: 'Europe/Budapest'
              }
            },
            uploadTargetUser: 'abc123'
          }
        };
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.putTargetsInStorage());
      });
    });
  });

  describe('retrieveTargetsFromStorage', () => {
    describe('no targets retrieved from local storage', () => {
      it('should dispatch SET_PAGE (redirect to settings page)', (done) => {
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_PAGE,
            payload: {page: pages.SETTINGS},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          localStore: {
            getItem: () => null
          }
        });
        const store = mockStore({}, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('targets retrieved, but no user targeted for upload by default', () => {
      it('should dispatch SET_USERS_TARGETS, then SET_PAGE (redirect to main page for user selection)', (done) => {
        const targets = {
          abc123: [{key: 'carelink', timezone: 'US/Eastern'}],
          def456: [
            {key: 'dexcom', timezone: 'US/Mountain'},
            {key: 'omnipod', timezone: 'US/Mountain'}
          ]
        };
        const expectedActions = [
          {
            type: actionTypes.RETRIEVING_USERS_TARGETS,
            meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_USERS_TARGETS,
            payload: { targets },
            meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
          },
          {
            type: actionTypes.SET_PAGE,
            payload: {page: pages.MAIN},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          localStore: {
            getItem: () => targets
          }
        });
        const store = mockStore({users: {
          loggedInUser: 'ghi789',
          ghi789: {},
          abc123: {},
          def456: {},
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: null
        }}, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });
  });
});