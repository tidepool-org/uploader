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

import _ from 'lodash'
import { isFSA } from 'flux-standard-action'
import configureStore from 'redux-mock-store'
import thunk from 'redux-thunk'

import { ActionSources, ActionTypes, Pages } from '../../../../lib/redux/actions/constants'
import * as AsyncActions from '../../../../lib/redux/actions/async'
import { getLoginErrorMessage } from '../../../../lib/redux/errors'

const middlewares = [thunk]
const mockStore = configureStore(middlewares)

global.chrome = {
  contextMenus: {
    removeAll: _.noop
  },
  runtime: {
    getManifest: function() { return {permissions: [{usbDevices: [{driverId: '12345'}]}]} },
    getPlatformInfo: function(cb) { return cb({os: 'test'}) }
  }
}

describe('async actions', () => {
  describe('doAppInit [no session token in local storage]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, SET_FORGOT_PASSWORD_URL, SET_SIGNUP_URL, SET_PAGE, INIT_APP_DONE actions', (done) => {
      const config = {
        version: '0.100.0',
        API_URL: 'http://www.acme.com/'
      }
      const servicesToInit = {
        api: {
          init: (opts, cb) => { cb() },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com/' + path
          },
          setHosts: _.noop
        },
        carelink: {
          init: (opts, cb) => { cb() }
        },
        device: {
          init: (opts, cb) => { cb() }
        },
        localStore: {
          init: (opts, cb) => { cb() },
          getInitialState: _.noop
        },
        log: _.noop
      }
      const expectedActions = [
        {
          type: ActionTypes.SET_VERSION,
          payload: {version: '0.100.0'},
          meta: {source: ActionSources[ActionTypes.SET_VERSION]}
        },
        {
          type: ActionTypes.INIT_APP_REQUEST,
          meta: {source: ActionSources[ActionTypes.INIT_APP_REQUEST]}
        },
        {
          type: ActionTypes.SET_OS,
          payload: {os: 'test'},
          meta: {source: ActionSources[ActionTypes.SET_OS]}
        },
        {
          type: ActionTypes.SET_FORGOT_PASSWORD_URL,
          payload: {url: 'http://www.acme.com/#/request-password-from-uploader'},
          meta: {source: ActionSources[ActionTypes.SET_FORGOT_PASSWORD_URL]}
        },
        {
          type: ActionTypes.SET_SIGNUP_URL,
          payload: {url: 'http://www.acme.com/#/signup'},
          meta: {source: ActionSources[ActionTypes.SET_SIGNUP_URL]}
        },
        {
          type: ActionTypes.SET_PAGE,
          payload: {page: Pages.LOGIN},
          meta: {source: ActionSources[ActionTypes.SET_PAGE]}
        },
        {
          type: ActionTypes.INIT_APP_DONE,
          payload: {session: null},
          meta: {source: ActionSources[ActionTypes.INIT_APP_DONE]}
        }
      ]
      const store = mockStore({}, expectedActions, done)
      store.dispatch(AsyncActions.doAppInit(config, servicesToInit))
    })
  })

  describe('doAppInit [with session token in local storage]', () => {
    it('should dispatch a bunch of actions')
  })

  describe('doAppInit [with error in api init]', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, SET_OS, INIT_APP_DONE actions', (done) => {
      const config = {
        version: '0.100.0',
        API_URL: 'http://www.acme.com/'
      }
      const servicesToInit = {
        api: {
          init: (opts, cb) => { cb('Error!') },
          makeBlipUrl: (path) => {
            return 'http://www.acme.com/' + path
          },
          setHosts: _.noop
        },
        carelink: {
          init: (opts, cb) => { cb() }
        },
        device: {
          init: (opts, cb) => { cb() }
        },
        localStore: {
          init: (opts, cb) => { cb() },
          getInitialState: _.noop
        },
        log: _.noop
      }
      const expectedActions = [
        {
          type: ActionTypes.SET_VERSION,
          payload: {version: '0.100.0'},
          meta: {source: ActionSources[ActionTypes.SET_VERSION]}
        },
        {
          type: ActionTypes.INIT_APP_REQUEST,
          meta: {source: ActionSources[ActionTypes.INIT_APP_REQUEST]}
        },
        {
          type: ActionTypes.SET_OS,
          payload: {os: 'test'},
          meta: {source: ActionSources[ActionTypes.SET_OS]}
        },
        {
          type: ActionTypes.INIT_APP_DONE,
          error: true,
          payload: new Error('Error during app initialization.'),
          meta: {source: ActionSources[ActionTypes.INIT_APP_DONE]}
        }
      ]
      const store = mockStore({}, expectedActions, done)
      store.dispatch(AsyncActions.doAppInit(config, servicesToInit))
    })
  })

  describe('doLogin [no remember me]', () => {
    it('should dispatch LOGIN_REQUEST, LOGIN_DONE, SET_PAGE actions', (done) => {
      // NB: this is not what these objects actually look like
      // actual shape is irrelevant to testing action creators
      const userObj = {user: {userid: 'abc123'}}
      const profile = {fullName: 'Jane Doe'}
      const memberships = [{userid: 'def456'}, {userid: 'ghi789'}]
      const expectedActions = [
        {
          type: ActionTypes.LOGIN_REQUEST,
          meta: {source: ActionSources[ActionTypes.LOGIN_REQUEST]}
        },
        {
          type: ActionTypes.LOGIN_DONE,
          payload: {
            user: userObj.user,
            profile, memberships
          },
          meta: {source: ActionSources[ActionTypes.LOGIN_DONE]}
        },
        {
          type: ActionTypes.SET_PAGE,
          payload: {page: Pages.MAIN},
          meta: {source: ActionSources[ActionTypes.SET_PAGE]}
        }
      ]
      AsyncActions.__Rewire__('services', {
        api: {
          user: {
            login: (creds, opts, cb) => cb(null, userObj),
            profile: (cb) => cb(null, profile),
            getUploadGroups: (cb) => cb(null, memberships)
          }
        },
        log: _.noop
      })
      const store = mockStore({}, expectedActions, () => {
        AsyncActions.__ResetDependency__('services')
        done()
      })
      store.dispatch(AsyncActions.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ))
    })
  })

  describe('doLogin [with remember me]', () => {
    it('should dispatch a bunch of actions')
  })

  describe('doLogin [with error]', () => {
    it('should dispatch LOGIN_REQUEST, LOGIN_DONE actions', (done) => {
      const expectedActions = [
        {
          type: ActionTypes.LOGIN_REQUEST,
          meta: {source: ActionSources[ActionTypes.LOGIN_REQUEST]}
        },
        {
          type: ActionTypes.LOGIN_DONE,
          error: true,
          payload: new Error(getLoginErrorMessage()),
          meta: {source: ActionSources[ActionTypes.LOGIN_DONE]}
        }
      ]
      AsyncActions.__Rewire__('services', {
        api: {
          user: {
            login: (creds, opts, cb) => cb(getLoginErrorMessage()),
            getUploadGroups: (cb) => cb(null, [])
          }
        }
      })
      const store = mockStore({}, expectedActions, done)
      store.dispatch(AsyncActions.doLogin(
        {username: 'jane.doe@me.com', password: 'password'},
        {remember: false}
      ))
    })
  })
})