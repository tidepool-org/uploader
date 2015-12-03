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

import localStore from '../../../../lib/core/localStore'
import { ActionSources, ActionTypes, Pages } from '../../../../lib/redux/actions/constants'
import * as AsyncActions from '../../../../lib/redux/actions/async'

const middlewares = [thunk]
const mockStore = configureStore(middlewares)

global.chrome = {
  runtime: {
    getManifest: function() { return {permissions: [{usbDevices: [{driverId: '12345'}]}]} },
    getPlatformInfo: function(cb) { return cb({os: 'test'}) }
  }
}

describe('async actions', () => {
  describe('doAppInit, no session token in local storage', () => {
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
        localStore,
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

  describe('doAppInit, session token in local storage', () => {
    it('should dispatch a bunch of actions')
  })

  describe('doAppInit, with error in localStore init', () => {
    it('should dispatch SET_VERSION, INIT_APP_REQUEST, INIT_APP_DONE actions', (done) => {
      const config = {
        callBackArg: 'Error!',
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
        localStore,
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
})