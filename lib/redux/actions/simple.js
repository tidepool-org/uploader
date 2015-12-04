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

import { ActionSources, ActionTypes, Pages, Paths } from './constants'
import { ErrorText, getLoginErrorMessage } from '../errors'

export function setForgotPasswordUrl(url) {
  return {
    type: ActionTypes.SET_FORGOT_PASSWORD_URL,
    payload: { url },
    meta: {source: ActionSources[ActionTypes.SET_FORGOT_PASSWORD_URL]}
  }
}

export function setSignUpUrl(url) {
  return {
    type: ActionTypes.SET_SIGNUP_URL,
    payload: { url },
    meta: {source: ActionSources[ActionTypes.SET_SIGNUP_URL]}
  }
}

export function setOs(os) {
  return {
    type: ActionTypes.SET_OS,
    payload: { os },
    meta: {source: ActionSources[ActionTypes.SET_OS]}
  }
}

export function setPage(page) {
  return {
    type: ActionTypes.SET_PAGE,
    payload: { page },
    meta: {source: ActionSources[ActionTypes.SET_PAGE]}
  }
}

export function setVersion(version) {
  return {
    type: ActionTypes.SET_VERSION,
    payload: { version },
    meta: {source: ActionSources[ActionTypes.SET_VERSION]}
  }
}

export function toggleDropdown(previous) {
  return {
    type: ActionTypes.TOGGLE_DROPDOWN,
    payload: { isVisible: !previous },
    meta: {source: ActionSources[ActionTypes.TOGGLE_DROPDOWN]}
  }
}

/*
 * relating to async action creator doAppInit
 */

export function initRequest() {
  return {
    type: ActionTypes.INIT_APP_REQUEST,
    meta: {source: ActionSources[ActionTypes.INIT_APP_REQUEST]}
  }
}

export function initDone(session) {
  return {
    type: ActionTypes.INIT_APP_DONE,
    payload: {
      // standardize on null for empty payload fields
      session: session === undefined ? null : session
    },
    meta: {source: ActionSources[ActionTypes.INIT_APP_DONE]}
  }
}

export function initError() {
  return {
    type: ActionTypes.INIT_APP_DONE,
    error: true,
    payload: new Error(ErrorText.E_INIT),
    meta: {source: ActionSources[ActionTypes.INIT_APP_DONE]}
  }
}

/*
 * relating to async action creator doLogin
 */

export function loginRequest() {
  return {
    type: ActionTypes.LOGIN_REQUEST,
    meta: {source: ActionSources[ActionTypes.LOGIN_REQUEST]}
  }
}

export function loginDone(results) {
  return {
    type: ActionTypes.LOGIN_DONE,
    payload: {
      user: results[0].user,
      profile: results[1],
      memberships: results[2]
    },
    meta: {source: ActionSources[ActionTypes.LOGIN_DONE]}
  }
}

export function loginError(errorCode) {
  return {
    type: ActionTypes.LOGIN_DONE,
    error: true,
    payload: new Error(getLoginErrorMessage(errorCode)),
    meta: {source: ActionSources[ActionTypes.LOGIN_DONE]}
  }
}