/* global chrome */

import _ from 'lodash'
import async from 'async'

/*
 * action types
 */

export const SET_OS = 'SET_OS'
export const SET_PAGE = 'SET_PAGE'
export const INIT_APP_REQUEST = 'INIT_APP_REQUEST'
export const INIT_APP_DONE = 'INIT_APP_DONE'

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
      // standardize on null for "empty" payload fields
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
  const { api, carelink, device, localStore, log } = services
  return function(dispatch) {
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
        makeLogAndCallbackFn('Set all api hosts.', cb)()
      }
    ], function(err, results) {
      if (err) {
        dispatch(initError(err))
      }

      dispatch(initDone(results[4]))
    })
  }
}

export function setOs(os) {
  return { type: SET_OS, payload: { os } }
}

export function setPage(page) {
  return { type: SET_PAGE, payload: { page } }
}