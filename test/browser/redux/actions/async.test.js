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
import { pages, steps, urls } from '../../../../lib/redux/constants/otherConstants';
import { UnsupportedError } from '../../../../lib/redux/utils/errors';
import errorText from '../../../../lib/redux/constants/errors';

import * as asyncActions from '../../../../lib/redux/actions/async';
import { getLoginErrorMessage, getLogoutErrorMessage } from '../../../../lib/redux/utils/errors';

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

  describe('doAppInit [hot reload, app already initialized]', () => {
    it('should dispatch no actions!', (done) => {
      const expectedActions = [];
      const store = mockStore({working: {initializingApp: false}}, expectedActions, done.fail);
      store.dispatch(asyncActions.doAppInit({}, {}));
      // somewhat hacky solution to testing for no actions
      // discussed here: https://github.com/arnaudbenard/redux-mock-store/issues/17
      // happy to live with the hack since this is only for hot-reloading anyway
      setTimeout(() => done(), 1000);
    });
  });

  describe('doAppInit [no session token in local storage]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_PAGE, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS actions', (done) => {
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
          type: actionTypes.SET_PAGE,
          payload: {page: pages.LOGIN},
          meta: {source: actionSources[actionTypes.SET_PAGE]}
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
      asyncActions.__Rewire__('versionInfo', {
        semver: config.version
      });
      const store = mockStore({working: {initializingApp: true}}, expectedActions, done);
      store.dispatch(asyncActions.doAppInit(config, servicesToInit));
    });
  });

  describe('doAppInit [with session token in local storage]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, INIT_APP_SUCCESS, VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, SET_USER_INFO_FROM_TOKEN, SET_BLIP_VIEW_DATA_URL, RETRIEVING_USERS_TARGETS, SET_PAGE actions', (done) => {
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
            account: (cb) => { cb(null, pwd.user); },
            loggedInProfile: (cb) => { cb(null, pwd.profile); },
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
          type: actionTypes.SET_BLIP_VIEW_DATA_URL,
          payload: {url: `http://www.acme.com/patients/${pwd.user.userid}/data`},
          meta: {source: actionSources[actionTypes.SET_BLIP_VIEW_DATA_URL]}
        },
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
      asyncActions.__Rewire__('versionInfo', {
        semver: config.version
      });
      const state = {
        uploadTargetUser: pwd.user.userid,
        working: {initializingApp: true}
      };
      const store = mockStore(state, expectedActions, done);
      store.dispatch(asyncActions.doAppInit(config, servicesToInit));
    });
  });

  describe('doAppInit [with error in api init]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, HIDE_UNAVAILABLE_DEVICES, INIT_APP_FAILURE actions', (done) => {
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
          payload: new Error(errorText.E_INIT),
          meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
        }
      ];
      asyncActions.__Rewire__('versionInfo', {
        semver: config.version
      });
      const store = mockStore({working: {initializingApp: true}}, expectedActions, done);
      store.dispatch(asyncActions.doAppInit(config, servicesToInit));
    });
  });

  describe('doLogin [no error]', () => {
    it('should dispatch LOGIN_REQUEST, LOGIN_SUCCESS actions', (done) => {
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
            metric: {eventName: metrics.LOGIN_SUCCESS}
          }
        }
      ];
      asyncActions.__Rewire__('services', {
        api: {
          user: {
            login: (creds, opts, cb) => cb(null, userObj),
            loggedInProfile: (cb) => cb(null, profile),
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

  describe('doLogout [no error]', () => {
    it('should dispatch LOGOUT_REQUEST, LOGOUT_SUCCESS, SET_PAGE actions', (done) => {
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
          type: actionTypes.SET_PAGE,
          payload: {page: pages.LOGIN},
          meta: {source: actionSources.USER}
        }
      ];
      asyncActions.__Rewire__('services', {
        api: {
          user: {
            logout: (cb) => cb(null)
          }
        }
      });
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doLogout());
    });
  });

  describe('doLogout [with error]', () => {
    it('should dispatch LOGOUT_REQUEST, LOGOUT_FAILURE, SET_PAGE actions', (done) => {
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
          meta: {source: actionSources[actionTypes.LOGOUT_SUCCESS]}
        },
        {
          type: actionTypes.SET_PAGE,
          payload: {page: pages.LOGIN},
          meta: {source: actionSources.USER}
        }
      ];
      asyncActions.__Rewire__('services', {
        api: {
          user: {
            logout: (cb) => cb('Error :(')
          }
        }
      });
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doLogout());
    });
  });

  describe('doUpload [upload aborted b/c version check failed]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_FAILURE, UPLOAD_ABORTED', (done) => {
      const requiredVersion = '0.99.0';
      const currentVersion = '0.50.0';
      asyncActions.__Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: requiredVersion})
          }
        }
      });
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
          payload: new Error(errorText.E_UPLOAD_IN_PROGRESS),
          meta: {source: actionSources[actionTypes.UPLOAD_ABORTED]}
        }
      ];
      asyncActions.__Rewire__('versionInfo', {
        semver: currentVersion
      });
      const store = mockStore({}, expectedActions, done);
      store.dispatch(asyncActions.doUpload());
    });
  });

  describe('doUpload [upload aborted b/c another upload already in progress]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_ABORTED', (done) => {
      const initialState = {
        working: {uploading: true}
      };
      asyncActions.__Rewire__('services', {
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
          payload: new Error(errorText.E_UPLOAD_IN_PROGRESS),
          meta: {source: actionSources[actionTypes.UPLOAD_ABORTED]}
        }
      ];
      asyncActions.__Rewire__('versionInfo', {
        semver: '0.100.0'
      });
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload());
    });
  });

  describe('doUpload [device, driver error]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: true},
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_DRIVER'
      };
      let err = new Error(`You may need to install the ${targetDevice.name} device driver.`);
      err.driverLink = urls.DRIVER_DOWNLOAD;
      err.code = errProps.code;
      err.utc = errProps.utc;
      err.version = errProps.version;
      err.debug = `UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
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
              eventName: 'Upload Attempted AcmePump',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
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
              eventName: 'Upload Failed AcmePump',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [device, device detection error (serial)]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: false},
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_SERIAL_CONNECTION'
      };
      let err = new Error(errorText.E_SERIAL_CONNECTION);
      err.code = errProps.code;
      err.utc = errProps.utc;
      err.version = errProps.version;
      err.debug = `UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
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
              eventName: 'Upload Attempted AcmePump',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
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
              eventName: 'Upload Failed AcmePump',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [device, device detection error (hid)]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: false},
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_HID_CONNECTION'
      };
      let err = new Error(errorText.E_HID_CONNECTION);
      err.code = errProps.code;
      err.utc = errProps.utc;
      err.version = errProps.version;
      err.debug = `UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
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
              eventName: 'Upload Attempted AcmePump',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
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
              eventName: 'Upload Failed AcmePump',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [device, error during upload]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: false},
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_DEVICE_UPLOAD'
      };
      const basalErr = 'Problem processing basal!';
      let err = new Error(errorText.E_DEVICE_UPLOAD);
      err.details = basalErr;
      err.utc = errProps.utc;
      err.name = 'Error';
      err.code = errProps.code;
      err.version = errProps.version;
      err.debug = `Details: ${basalErr} | UTC Time: ${time} | Name: Error | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
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
              eventName: 'Upload Attempted AcmePump',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
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
              eventName: 'Upload Failed AcmePump',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [no error]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, DEVICE_DETECT_REQUEST, UPLOAD_SUCCESS actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'a_pump';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: false},
        source: {type: 'device', driverId: 'AcmePump'}
      };
      const initialState = {
        devices: {
          a_pump: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            a_pump: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'a_pump']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      asyncActions.__Rewire__('services', {
        api: {
          upload: {
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        device: {
          detect: (foo, bar, cb) => cb(null, {}),
          upload: (foo, bar, cb) => cb(null, [1,2,3,4,5])
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
              eventName: 'Upload Attempted AcmePump',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
            }
          }
        },
        {
          type: actionTypes.DEVICE_DETECT_REQUEST,
          meta: {source: actionSources[actionTypes.DEVICE_DETECT_REQUEST]}
        },
        {
          type: actionTypes.UPLOAD_SUCCESS,
          payload: { userId, deviceKey, utc: time, data: [1,2,3,4,5] },
          meta: {
            source: actionSources[actionTypes.UPLOAD_SUCCESS],
            metric: {
              eventName: 'Upload Successful AcmePump',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                started: time,
                finished: time,
                processed: 5
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [CareLink fetch error]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, CARELINK_FETCH_REQUEST, CARELINK_FETCH_FAILURE, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'CareLink',
        showDriverLink: {mac: false},
        source: {type: 'carelink'}
      };
      const initialState = {
        devices: {
          carelink: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            carelink: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'carelink']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_FETCH_CARELINK'
      };
      let err = new Error(errorText.E_FETCH_CARELINK);
      err.details = 'Error!';
      err.utc = errProps.utc;
      err.code = errProps.code;
      err.version = errProps.version;
      err.debug = `Details: Error! | UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
        api: {
          upload: {
            fetchCarelinkData: (foo, cb) => cb(new Error('Error!')),
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
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted CareLink',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
            }
          }
        },
        {
          type: actionTypes.CARELINK_FETCH_REQUEST,
          payload: { userId, deviceKey },
          meta: {source: actionSources[actionTypes.CARELINK_FETCH_REQUEST]}
        },
        {
          type: actionTypes.CARELINK_FETCH_FAILURE,
          error: true,
          payload: new Error(errorText.E_FETCH_CARELINK),
          meta: {
            source: actionSources[actionTypes.CARELINK_FETCH_FAILURE],
            metric: {eventName: metrics.CARELINK_FETCH_FAILURE}
          }
        },
        {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: 'Upload Failed CareLink',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [CareLink fetch, incorrect creds]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, CARELINK_FETCH_REQUEST, CARELINK_FETCH_FAILURE, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'CareLink',
        showDriverLink: {mac: false},
        source: {type: 'carelink'}
      };
      const initialState = {
        devices: {
          carelink: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            carelink: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'carelink']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_CARELINK_CREDS'
      };
      let err = new Error(errorText.E_CARELINK_CREDS);
      err.utc = errProps.utc;
      err.code = errProps.code;
      err.version = errProps.version;
      err.debug = `UTC Time: ${time} | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
        api: {
          upload: {
            fetchCarelinkData: (foo, cb) => cb(null, '302 Moved Temporarily'),
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
          type: actionTypes.UPLOAD_REQUEST,
          payload: { userId, deviceKey, utc: time },
          meta: {
            source: actionSources[actionTypes.UPLOAD_REQUEST],
            metric: {
              eventName: 'Upload Attempted CareLink',
              properties: {type: targetDevice.source.type, source: targetDevice.source.driverId}
            }
          }
        },
        {
          type: actionTypes.CARELINK_FETCH_REQUEST,
          payload: { userId, deviceKey },
          meta: {source: actionSources[actionTypes.CARELINK_FETCH_REQUEST]}
        },
        {
          type: actionTypes.CARELINK_FETCH_FAILURE,
          error: true,
          payload: new Error(errorText.E_CARELINK_CREDS),
          meta: {
            source: actionSources[actionTypes.CARELINK_FETCH_FAILURE],
            metric: {eventName: metrics.CARELINK_FETCH_FAILURE}
          }
        },
        {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: 'Upload Failed CareLink',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [CareLink, error in processing & uploading]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, CARELINK_FETCH_REQUEST, CARELINK_FETCH_SUCCESS, UPLOAD_FAILURE actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: false},
        source: {type: 'carelink'}
      };
      const initialState = {
        devices: {
          carelink: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            carelink: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'carelink']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      const errProps = {
        utc: time,
        version: initialState.version,
        code: 'E_CARELINK_UPLOAD'
      };
      const basalErr = 'Problem processing basal!';
      let err = new Error(errorText.E_CARELINK_UPLOAD);
      err.details = basalErr;
      err.utc = errProps.utc;
      err.name = 'Error';
      err.code = errProps.code;
      err.version = errProps.version;
      err.debug = `Details: ${basalErr} | UTC Time: ${time} | Name: Error | Code: ${errProps.code} | Version: ${errProps.version}`;
      asyncActions.__Rewire__('services', {
        api: {
          upload: {
            fetchCarelinkData: (foo, cb) => cb(null, '1,2,3,4,5'),
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        carelink: {
          upload: (foo, bar, cb) => cb(new Error(basalErr))
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
              eventName: 'Upload Attempted CareLink',
              properties: {type: targetDevice.source.type, source: undefined}
            }
          }
        },
        {
          type: actionTypes.CARELINK_FETCH_REQUEST,
          payload: { userId, deviceKey },
          meta: {source: actionSources[actionTypes.CARELINK_FETCH_REQUEST]}
        },
        {
          type: actionTypes.CARELINK_FETCH_SUCCESS,
          payload: { userId, deviceKey },
          meta: {
            source: actionSources[actionTypes.CARELINK_FETCH_SUCCESS],
            metric: {eventName: metrics.CARELINK_FETCH_SUCCESS}
          }
        },
        {
          type: actionTypes.UPLOAD_FAILURE,
          error: true,
          payload: err,
          meta: {
            source: actionSources[actionTypes.UPLOAD_FAILURE],
            metric: {
              eventName: 'Upload Failed CareLink',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                error: err
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('doUpload [CareLink, no error]', () => {
    it('should dispatch VERSION_CHECK_REQUEST, VERSION_CHECK_SUCCESS, UPLOAD_REQUEST, CARELINK_FETCH_REQUEST, CARELINK_FETCH_SUCCESS, UPLOAD_SUCCESS actions', (done) => {
      const userId = 'a1b2c3', deviceKey = 'carelink';
      const time = '2016-01-01T12:05:00.123Z';
      const targetDevice = {
        key: deviceKey,
        name: 'Acme Insulin Pump',
        showDriverLink: {mac: false},
        source: {type: 'carelink'}
      };
      const initialState = {
        devices: {
          carelink: targetDevice
        },
        os: 'mac',
        uploadsByUser: {
          [userId]: {
            a_cgm: {},
            carelink: {history: [{start: time}]}
          }
        },
        targetDevices: {
          [userId]: ['a_cgm', 'carelink']
        },
        targetTimezones: {
          [userId]: 'US/Mountain'
        },
        uploadTargetDevice: deviceKey,
        uploadTargetUser: userId,
        version: '0.100.0',
        working: {uploading: false}
      };
      asyncActions.__Rewire__('services', {
        api: {
          upload: {
            fetchCarelinkData: (foo, cb) => cb(null, '1,2,3,4,5'),
            getVersions: (cb) => cb(null, {uploaderMinimum: '0.99.0'})
          }
        },
        carelink: {
          upload: (foo, bar, cb) => cb(null, [1,2,3,4])
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
              eventName: 'Upload Attempted CareLink',
              properties: {type: targetDevice.source.type, source: undefined}
            }
          }
        },
        {
          type: actionTypes.CARELINK_FETCH_REQUEST,
          payload: { userId, deviceKey },
          meta: {source: actionSources[actionTypes.CARELINK_FETCH_REQUEST]}
        },
        {
          type: actionTypes.CARELINK_FETCH_SUCCESS,
          payload: { userId, deviceKey },
          meta: {
            source: actionSources[actionTypes.CARELINK_FETCH_SUCCESS],
            metric: {eventName: metrics.CARELINK_FETCH_SUCCESS}
          }
        },
        {
          type: actionTypes.UPLOAD_SUCCESS,
          payload: { userId, deviceKey, utc: time, data: [1,2,3,4] },
          meta: {
            source: actionSources[actionTypes.UPLOAD_SUCCESS],
            metric: {
              eventName: 'Upload Successful CareLink',
              properties: {
                type: targetDevice.source.type,
                source: targetDevice.source.driverId,
                started: time,
                finished: time,
                processed: 4
              }
            }
          }
        }
      ];
      const store = mockStore(initialState, expectedActions, done);
      store.dispatch(asyncActions.doUpload(deviceKey, {}, time));
    });
  });

  describe('readFile', () => {
    describe('wrong file extension chosen', () => {
      it('should dispatch CHOOSING_FILE, READ_FILE_ABORTED actions', (done) => {
        const userId = 'abc123', deviceKey = 'a_pump', ext = '.abc', version = '0.100.0';
        let err = new Error(errorText.E_FILE_EXT + ext);
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
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.readFile(userId, deviceKey, {name: 'data.csv'}, ext));
      });
    });
  });

  describe('doVersionCheck', () => {
    describe('API error when attempting to get versions info from jellyfish', () => {
      it('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_FAILURE', (done) => {
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
            meta: {source: actionSources[actionTypes.VERSION_CHECK_FAILURE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(err); }
            }
          }
        });
        const store = mockStore({}, expectedActions, done);
        store.dispatch(asyncActions.doVersionCheck());
      });
    });

    describe('missing or invalid semver in response from jellyfish', () => {
      it('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_FAILURE', (done) => {
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
            meta: {source: actionSources[actionTypes.VERSION_CHECK_FAILURE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(err); }
            }
          }
        });
        const store = mockStore({}, expectedActions, done);
        store.dispatch(asyncActions.doVersionCheck());
      });
    });

    describe('uploader\'s version is below the required minimum', () => {
      it('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_FAILURE', (done) => {
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
        asyncActions.__Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(null, {uploaderMinimum: requiredVersion}); }
            }
          }
        });
        asyncActions.__Rewire__('versionInfo', {
          semver: currentVersion
        });
        const store = mockStore({}, expectedActions, done);
        store.dispatch(asyncActions.doVersionCheck());
      });
    });

    describe('uploader\'s version meets the minimum', () => {
      it('should dispatch VERSION_CHECK_REQUEST and VERSION_CHECK_SUCCESS', (done) => {
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
        asyncActions.__Rewire__('services', {
          api: {
            upload: {
              getVersions: (cb) => { cb(null, {uploaderMinimum: requiredVersion}); }
            }
          }
        });
        asyncActions.__Rewire__('versionInfo', {
          semver: currentVersion
        });
        const store = mockStore({}, expectedActions, done);
        store.dispatch(asyncActions.doVersionCheck());
      });
    });
  });

  describe('addTargetDevice', () => {
    it('should dispatch ADD_TARGET_DEVICE, SET_UPLOADS', (done) => {
      const DEVICE = 'a_pump', ID = 'abc123';
      const expectedActions = [
        {
          type: actionTypes.ADD_TARGET_DEVICE,
          payload: {userId: ID, deviceKey: DEVICE},
          meta: {source: actionSources[actionTypes.ADD_TARGET_DEVICE]}
        },
        {
          type: actionTypes.SET_UPLOADS,
          payload: { devicesByUser: { abc123: [ DEVICE, 'a_bg_meter' ] } },
          meta: { source: actionSources[actionTypes.SET_UPLOADS] }
        }
      ];
      const state = {
        targetDevices: {
          abc123: [ DEVICE, 'a_bg_meter']
        },
        uploadTargetUser: 'abc123'
      };
      const store = mockStore(state, expectedActions, done);
      store.dispatch(asyncActions.addTargetDevice(ID, DEVICE));
    });
  });

  describe('removeTargetDevice', () => {
    it('should dispatch REMOVE_TARGET_DEVICE, SET_UPLOADS', (done) => {
      const DEVICE = 'a_pump', ID = 'abc123';
      const expectedActions = [
        {
          type: actionTypes.REMOVE_TARGET_DEVICE,
          payload: {userId: ID, deviceKey: DEVICE},
          meta: {source: actionSources[actionTypes.REMOVE_TARGET_DEVICE]}
        },
        {
          type: actionTypes.SET_UPLOADS,
          payload: { devicesByUser: { abc123: [ 'a_bg_meter' ] } },
          meta: { source: actionSources[actionTypes.SET_UPLOADS] }
        }
      ];
      const state = {
        targetDevices: {
          abc123: [ 'a_bg_meter']
        },
        uploadTargetUser: 'abc123'
      };
      const store = mockStore(state, expectedActions, done);
      store.dispatch(asyncActions.removeTargetDevice(ID, DEVICE));
    });
  });

  describe('clickDeviceSelectionDone', () => {
    describe('no targets in local storage', () => {
      it('should dispatch SET_UPLOADS, SET_PAGE (redirect to main page)', (done) => {
        const expectedActions = [
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser: { abc123: [ 'a_pump', 'a_bg_meter' ] } },
            meta: { source: actionSources[actionTypes.SET_UPLOADS] }
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
          targetDevices: {
            abc123: ['a_pump', 'a_bg_meter']
          },
          targetTimezones: {
            abc123: 'Europe/Budapest'
          },
          uploadTargetUser: 'abc123'
        };
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.clickDeviceSelectionDone());
      });
    });

    describe('existing targets in local storage', () => {
      it('should dispatch SET_UPLOADS, SET_PAGE (redirect to main page)', (done) => {
        const expectedActions = [
          {
            type: actionTypes.SET_UPLOADS,
            payload: { devicesByUser: { abc123: [ 'a_pump', 'a_bg_meter' ] } },
            meta: { source: actionSources[actionTypes.SET_UPLOADS] }
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
          uploadTargetUser: 'abc123'
        };
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.clickDeviceSelectionDone());
      });
    });
  });

  describe('retrieveTargetsFromStorage', () => {
    const url = 'http://acme-blip.com/patients/abc123/data';
    const blipUrlMaker = (path) => { return 'http://acme-blip.com' + path; };
    describe('no targets retrieved from local storage, no targets exist in state', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_PAGE (redirect to settings page)', (done) => {
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
            getItem: () => null,
            removeItem: (item) => null
          }
        });
        const store = mockStore({}, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('no targets retrieved from local storage, targets exist in state but no user targeted for upload by default', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_PAGE (redirect to settings page for user selection)', (done) => {
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
            'abc123': ['carelink']
          }
        };
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('no targets retrieved from local storage, targets exist in state but user targeted for upload is missing timezone', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_PAGE (redirect to main page for timezone selection)', (done) => {
        const devicesByUser = {
          abc123: ['carelink'],
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.MAIN},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
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
          devices: {
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: {
            abc123: ['carelink'],
            def456: ['dexcom', 'omnipod']
          }
        };
        const store = mockStore(state, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('no targets retrieved from local storage, targets exist in state but user targeted has no supported devices', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_PAGE (redirect to settings page for device selection)', (done) => {
        const devicesByUser = {
          abc123: ['carelink'],
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.SETTINGS},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
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
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser
        }, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('no targets retrieved from local storage, targets exist in state and user targeted for upload is all set to upload', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, then SET_PAGE (redirect to main page)', (done) => {
        const devicesByUser = {
          abc123: ['carelink'],
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.MAIN},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
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
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser
        }, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('targets retrieved, but no user targeted for upload by default', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_USERS_TARGETS, SET_UPLOADS, then SET_PAGE (redirect to settings page for user selection)', (done) => {
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.SETTINGS},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
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
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: null
        }, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('targets retrieved, user targeted for upload is missing timezone', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, then SET_PAGE (redirect to main page for timezone selection)', (done) => {
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
            type: actionTypes.SET_PAGE,
            payload: { page: pages.MAIN },
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker
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
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          targetsForUpload: ['abc123', 'def456'],
          uploadTargetUser: 'abc123',
          targetDevices: {
            'abc123': ['carelink']
          }
        }, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('targets retrieved, user targeted for upload has no supported devices', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, then SET_PAGE (redirect to settings page for device selection)', (done) => {
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.SETTINGS},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker
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
        }, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
      });
    });

    describe('targets retrieved, user targeted for upload is all set to upload', () => {
      it('should dispatch RETRIEVING_USERS_TARGETS, SET_UPLOADS, SET_USERS_TARGETS, then SET_PAGE (redirect to main page)', (done) => {
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.MAIN},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', {
          api: {
            makeBlipUrl: blipUrlMaker
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
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          loggedInUser: 'ghi789',
          uploadTargetUser: 'abc123',
          targetDevices: devicesByUser
        }, expectedActions, done);
        store.dispatch(asyncActions.retrieveTargetsFromStorage());
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
      it('should dispatch just SET_UPLOAD_TARGET_USER and SET_BLIP_VIEW_DATA_URL', (done) => {
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
        asyncActions.__Rewire__('services', apiRewire);
        const store = mockStore({
          users: {
            abc123: {
              targets: {
                devices: ['a_pump'],
                timezone: 'Europe/London'
              }
            }
          }
        }, expectedActions, done);
        store.dispatch(asyncActions.setUploadTargetUserAndMaybeRedirect(userId));
      });
    });

    describe('new target user has not selected devices', () => {
      it('should dispatch SET_UPLOAD_TARGET_USER, SET_BLIP_VIEW_DATA_URL, and SET_PAGE (redirect to settings)', (done) => {
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.SETTINGS},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', apiRewire);
        const store = mockStore({
          devices: {
            carelink: {},
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
        }, expectedActions, done);
        store.dispatch(asyncActions.setUploadTargetUserAndMaybeRedirect(userId));
      });
    });

    describe('new target user has not selected timezone', () => {
      it('should dispatch SET_UPLOAD_TARGET_USER, SET_BLIP_VIEW_DATA_URL, and SET_PAGE (redirect to settings)', (done) => {
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
            type: actionTypes.SET_PAGE,
            payload: {page: pages.SETTINGS},
            meta: {source: actionSources[actionTypes.SET_PAGE]}
          }
        ];
        asyncActions.__Rewire__('services', apiRewire);
        const store = mockStore({
          devices: {
            carelink: {},
            dexcom: {},
            omnipod: {}
          },
          users: {
            abc123: {
              targets: {
                devices: ['carelink']
              }
            }
          }
        }, expectedActions, done);
        store.dispatch(asyncActions.setUploadTargetUserAndMaybeRedirect(userId));
      });
    });
  });
});
