/* global chrome */

import _ from 'lodash'
import async from 'async'

import { ErrorText, getLoginErrorMessage } from './errors'

let services = {}
let versionInfo = {}

/*
 * ACTION TYPES
 */

export const ActionTypes = {
  INIT_APP_REQUEST: 'INIT_APP_REQUEST',
  INIT_APP_DONE: 'INIT_APP_DONE',
  LOGIN_REQUEST: 'LOGIN_REQUEST',
  LOGIN_DONE: 'LOGIN_DONE',
  SET_FORGOT_PASSWORD_URL: 'SET_FORGOT_PASSWORD_URL',
  SET_SIGNUP_URL: 'SET_SIGNUP_URL',
  SET_OS: 'SET_OS',
  SET_PAGE: 'SET_PAGE',
  SET_VERSION: 'SET_VERSION',
  TOGGLE_DROPDOWN: 'TOGGLE_DROPDOWN'
}

/*
 * OTHER CONSTANTS
 */

export const Pages = {
  LOADING: 'LOADING',
  LOGIN: 'LOGIN',
  MAIN: 'MAIN',
  SETTINGS: 'SETTINGS',
  OUT_OF_DATE: 'OUT_OF_DATE'
}

const Paths = {
  FORGOT_PASSWORD: '#/request-password-from-uploader',
  SIGNUP: '#/signup'
}

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
    dispatch(setVersion(config.version))
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
            dispatch(setOs(platformInfo.os))
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
        dispatch(setForgotPasswordUrl(api.makeBlipUrl(Paths.FORGOT_PASSWORD)))
        dispatch(setSignUpUrl(api.makeBlipUrl(Paths.SIGNUP)))
        makeLogAndCallbackFn('Set all api hosts.', cb)()
      }
    ], function(err, results) {
      if (err) {
        // TODO: surface this error in UI or at least via metric call?
        return dispatch(initError())
      }
      
      let session = results[4]
      if (session === undefined) {
        dispatch(setPage(Pages.LOGIN))
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
      dispatch(setPage(Pages.MAIN))
    })
  }
}

export function setForgotPasswordUrl(url) {
  return { type: ActionTypes.SET_FORGOT_PASSWORD_URL, payload: { url } }
}

export function setSignUpUrl(url) {
  return { type: ActionTypes.SET_SIGNUP_URL, payload: { url } }
}

export function setOs(os) {
  return { type: ActionTypes.SET_OS, payload: { os } }
}

export function setPage(page) {
  return { type: ActionTypes.SET_PAGE, payload: { page } }
}

export function setVersion(version) {
  return { type: ActionTypes.SET_VERSION, payload: { version }}
}

export function toggleDropdown(previous) {
  return { type: ActionTypes.TOGGLE_DROPDOWN, payload: { isVisible: !previous }}
}