/* global chrome */

import _ from 'lodash'
import async from 'async'

import { ActionTypes, Pages, Paths } from './constants'
import { ErrorText, getLoginErrorMessage } from '../errors'
import * as SimpleActions from './simple'

let services = {}
let versionInfo = {}

/*
 * ACTION CREATORS
 */

function initRequest() {
  return {
    type: ActionTypes.INIT_APP_REQUEST
  }
}

function initDone(session) {
  return {
    type: ActionTypes.INIT_APP_DONE,
    payload: {
      // standardize on null for empty payload fields
      session: session === undefined ? null : session
    }
  }
}

function initError() {
  return {
    type: ActionTypes.INIT_APP_DONE,
    error: true,
    payload: new Error(ErrorText.E_INIT)
  }
}

export function doAppInit(config, servicesToInit) {
  return function(dispatch) {
    dispatch(SimpleActions.setVersion(config.version))
    services = servicesToInit
    versionInfo.semver = config.version
    versionInfo.name = config.namedVersion
    const { api, carelink, device, localStore, log } = services

    dispatch(initRequest())

    function makeLogAndCallbackFn(msg, cb) {
      return () => {
        log(msg)
        cb()
      } 
    }

    async.series([
      (cb) => {
        localStore.init(
          localStore.getInitialState(),
          makeLogAndCallbackFn('Initialized local store.', cb)
        )
      },
      (cb) => {
        if (typeof chrome !== 'undefined') {
          chrome.runtime.getPlatformInfo(function(platformInfo) {
            dispatch(SimpleActions.setOs(platformInfo.os))
            log('Retrieved operating system info:', platformInfo.os)
            cb()
          })
        }
      },
      (cb) => {
        device.init({
          api,
          version: config.namedVersion
        }, makeLogAndCallbackFn('Initialized device.', cb))
      },
      (cb) => {
        api.init({
          apiUrl: config.API_URL,
          uploadUrl: config.UPLOAD_URL
        }, makeLogAndCallbackFn(`Initialized api with URL: ${config.API_URL}`, cb))
      },
      (cb) => {
        api.setHosts(_.pick(config, ['API_URL', 'UPLOAD_URL', 'BLIP_URL']))
        dispatch(SimpleActions.setForgotPasswordUrl(api.makeBlipUrl(Paths.FORGOT_PASSWORD)))
        dispatch(SimpleActions.setSignUpUrl(api.makeBlipUrl(Paths.SIGNUP)))
        makeLogAndCallbackFn('Set all api hosts.', cb)()
      }
    ], function(err, results) {
      if (err) {
        // TODO: surface this error in UI or at least via metric call?
        return dispatch(initError())
      }
      
      let session = results[4]
      if (session === undefined) {
        dispatch(SimpleActions.setPage(Pages.LOGIN))
      }
      dispatch(initDone(session))
    })
  }
}

function loginRequest() {
  return {
    type: ActionTypes.LOGIN_REQUEST
  }
}

function loginDone(results) {
  return {
    type: ActionTypes.LOGIN_DONE,
    payload: {
      user: results[0].user,
      profile: results[1],
      careteam: results[2]
    }
  }
}

function loginError(errorCode) {
  return {
    type: ActionTypes.LOGIN_DONE,
    error: true,
    payload: new Error(getLoginErrorMessage(errorCode))
  }
}

export function doLogin(creds, opts) {
  return function(dispatch) {
    const { api } = services
    dispatch(loginRequest())

    async.series([
      api.user.login.bind(null, creds, opts),
      api.user.profile,
      api.user.getUploadGroups.bind(null)
    ], function(err, results) {
      if (err) {
        return dispatch(loginError(err.status))
      }
      // remove env-switching context menu after login
      if (typeof chrome !== 'undefined') {
        services.log('Removed Chrome context menu.')
        chrome.contextMenus.removeAll();
      }
      dispatch(loginDone(results))
      dispatch(SimpleActions.setPage(Pages.MAIN))
    })
  }
}
