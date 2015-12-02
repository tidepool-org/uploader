/* global chrome */

import _ from 'lodash'
import async from 'async'

/*
 * action types
 */

export const INIT_APP_REQUEST = 'INIT_APP_REQUEST'
export const INIT_APP_DONE = 'INIT_APP_DONE'

export const SET_FORGOT_PASSWORD_URL = 'MAKE_FORGOT_PASSWORD_URL'
export const SET_OS = 'SET_OS'
export const SET_PAGE = 'SET_PAGE'
export const SET_VERSION = 'SET_VERSION'

export const TOGGLE_DROPDOWN = 'TOGGLE_DROPDOWN'

/*
 * other constants
 */

export const Pages = {
  LOADING: 'LOADING',
  LOGIN: 'LOGIN',
  MAIN: 'MAIN',
  SETTINGS: 'SETTINGS',
  OUT_OF_DATE: 'OUT_OF_DATE'
}

const Paths = {
  FORGOT_PASSWORD: '#/request-password-from-uploader'
}

/*
 * action creators
 */

function initRequest() {
  return {
    type: INIT_APP_REQUEST
  }
}

function initDone(session) {
  return {
    type: INIT_APP_DONE,
    payload: {
      // standardize on null for empty payload fields
      session: session === undefined ? null : session
    }
  }
}

function initError(err) {
  return {
    type: INIT_APP_DONE,
    error: true,
    payload: err
  }
}

export function appInit(config, services, cb) {
  return function(dispatch) {
    dispatch(setVersion(config.version))
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
        makeLogAndCallbackFn('Set all api hosts.', cb)()
      }
    ], function(err, results) {
      if (err) {
        dispatch(initError(err))
      }
      
      let session = results[4]
      if (session === undefined) {
        dispatch(setPage(Pages.LOGIN))
      }
      dispatch(initDone(session))
    })
  }
}

export function setForgotPasswordUrl(url) {
  return { type: SET_FORGOT_PASSWORD_URL, payload: { url } }
}

export function setOs(os) {
  return { type: SET_OS, payload: { os } }
}

export function setPage(page) {
  return { type: SET_PAGE, payload: { page } }
}

export function setVersion(version) {
  return { type: SET_VERSION, payload: { version }}
}

export function toggleDropdown(previous) {
  return { type: TOGGLE_DROPDOWN, payload: { isVisible: !previous }}
}