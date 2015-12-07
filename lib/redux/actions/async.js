/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015, Tidepool Project
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

/* global chrome */

import _ from 'lodash'
import async from 'async'

import { ActionSources, ActionTypes, Pages, Paths } from './constants'
import * as SimpleActions from './simple'

let services = {}
let versionInfo = {}

/*
 * ACTION CREATORS
 */

export function doAppInit(config, servicesToInit) {
  return function(dispatch) {
    dispatch(SimpleActions.setVersion(config.version))
    services = servicesToInit
    versionInfo.semver = config.version
    versionInfo.name = config.namedVersion
    const { api, carelink, device, localStore, log } = services

    dispatch(SimpleActions.initRequest())

    async.series([
      (cb) => {
        log('Initializing local store.')
        localStore.init(localStore.getInitialState(), () => { cb() })
      },
      (cb) => {
        if (typeof chrome !== 'undefined') {
          chrome.runtime.getPlatformInfo(function(platformInfo) {
            dispatch(SimpleActions.setOs(platformInfo.os))
            log('Retrieved operating system info:', platformInfo.os)
            dispatch(SimpleActions.hideUnavailableDevices(platformInfo.os))
            cb()
          })
        }
      },
      (cb) => {
        log('Initializing device')
        device.init({
          api,
          version: config.namedVersion
        }, cb)
      },
      (cb) => {
        log('Initializing CareLink')
        carelink.init({ api }, cb)
      },
      (cb) => {
        log(`Initializing api with URL: ${config.API_URL}`)
        api.init({
          apiUrl: config.API_URL,
          uploadUrl: config.UPLOAD_URL
        }, cb)
      },
      (cb) => {
        log('Setting all api hosts')
        api.setHosts(_.pick(config, ['API_URL', 'UPLOAD_URL', 'BLIP_URL']))
        dispatch(SimpleActions.setForgotPasswordUrl(api.makeBlipUrl(Paths.FORGOT_PASSWORD)))
        dispatch(SimpleActions.setSignUpUrl(api.makeBlipUrl(Paths.SIGNUP)))
        cb()
      }
    ], function(err, results) {
      if (err) {
        // TODO: surface this error in UI or at least via metric call?
        return dispatch(SimpleActions.initError())
      }
      let session = results[4]
      if (session === undefined) {
        dispatch(SimpleActions.setPage(Pages.LOGIN))
        dispatch(SimpleActions.initDone())
        return
      }

      async.series([
        api.user.account,
        api.user.profile,
        api.user.getUploadGroups
      ], function(err, results) {
        if (err) {
          // TODO: surface this error in UI or at least via metric call?
          return dispatch(SimpleActions.initError())
        }
        // remove env-switching context menu after login
        if (typeof chrome !== 'undefined') {
          services.log('Removing Chrome context menu')
          chrome.contextMenus.removeAll();
        }
        dispatch(SimpleActions.initDone())
        dispatch(SimpleActions.loginDone({
          user: results[0],
          profile: results[1],
          memberships: results[2]
        }))
        dispatch(doSetLoggedInState())
      })
    })
  }
}

export function doLogin(creds, opts) {
  return function(dispatch) {
    const { api } = services
    dispatch(SimpleActions.loginRequest())

    async.series([
      api.user.login.bind(null, creds, opts),
      api.user.profile,
      api.user.getUploadGroups
    ], function(err, results) {
      if (err) {
        return dispatch(SimpleActions.loginError(err.status))
      }
      // remove env-switching context menu after login
      if (typeof chrome !== 'undefined') {
        services.log('Removing Chrome context menu')
        chrome.contextMenus.removeAll();
      }
      dispatch(SimpleActions.loginDone({
        user: results[0].user,
        profile: results[1],
        memberships: results[2]
      }))
      dispatch(doSetLoggedInState())
    })
  }
}

export function doSetLoggedInState() {
  return function(dispatch, getState) {
    dispatch(SimpleActions.setDefaultTargetId())
    const { devices, users } = getState()
    const { localStore } = services
    const targets = localStore.getItem('devices')
    if (targets === null) {
      dispatch(SimpleActions.setPage(Pages.SETTINGS))
      return
    }
    dispatch(SimpleActions.setUsersTargets(targets))

    if (users.uploadTargetUser === null) {
      dispatch(SimpleActions.setPage(Pages.MAIN))
      return
    }
    else {
      if (targets[users.uploadTargetUser] != null) {
        const userTargets = targets[users.uploadTargetUser]
        const targetDeviceKeys = _.pluck(targets, 'key')
        const supportedDeviceKeys = Object.keys(devices)
        const atLeastOneDeviceSupportedOnSystem = _.some(targetDeviceKeys, function(key) {
          return _.includes(supportedDeviceKeys, key);
        });
        const uniqTimezones = _.uniq(_.pluck(targets, 'timezone'));
        if (uniqTimezones.length === 1 && atLeastOneDeviceSupportedOnSystem) {
          dispatch(SimpleActions.setPage(Pages.MAIN))
        }
        else {
          dispatch(SimpleActions.setPage(Pages.SETTINGS))
        }
      }
    }
  }
}