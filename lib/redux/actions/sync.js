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

import * as actionTypes from '../constants/actionTypes';
import * as actionSources from '../constants/actionSources';
import * as metrics from '../constants/metrics';
import { pages, paths } from '../constants/otherConstants';

import { errorText, getLoginErrorMessage } from '../utils/errors';

export function addTargetDevice(userId, deviceKey) {
  return {
    type: actionTypes.ADD_TARGET_DEVICE,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.ADD_TARGET_DEVICE]}
  };
}

export function hideUnavailableDevices(os) {
  return {
    type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
    payload: { os },
    meta: {source: actionSources[actionTypes.HIDE_UNAVAILABLE_DEVICES]}
  };
}

export function removeTargetDevice(userId, deviceKey) {
  return {
    type: actionTypes.REMOVE_TARGET_DEVICE,
    payload: { userId, deviceKey },
    meta: {source: actionSources[actionTypes.REMOVE_TARGET_DEVICE]}
  };
}

export function setForgotPasswordUrl(url) {
  return {
    type: actionTypes.SET_FORGOT_PASSWORD_URL,
    payload: { url },
    meta: {source: actionSources[actionTypes.SET_FORGOT_PASSWORD_URL]}
  };
}

export function setOs(os) {
  return {
    type: actionTypes.SET_OS,
    payload: { os },
    meta: {source: actionSources[actionTypes.SET_OS]}
  };
}

export function setPage(page) {
  return {
    type: actionTypes.SET_PAGE,
    payload: { page },
    meta: {source: actionSources[actionTypes.SET_PAGE]}
  };
}

export function setSignUpUrl(url) {
  return {
    type: actionTypes.SET_SIGNUP_URL,
    payload: { url },
    meta: {source: actionSources[actionTypes.SET_SIGNUP_URL]}
  };
}

export function setTargetTimezone(userId, timezoneName) {
  return {
    type: actionTypes.SET_TARGET_TIMEZONE,
    payload: { userId, timezoneName },
    meta: {source: actionSources[actionTypes.SET_TARGET_TIMEZONE]} 
  };
}

export function setVersion(version) {
  return {
    type: actionTypes.SET_VERSION,
    payload: { version },
    meta: {source: actionSources[actionTypes.SET_VERSION]}
  };
}

export function toggleDropdown(previous) {
  return {
    type: actionTypes.TOGGLE_DROPDOWN,
    payload: { isVisible: !previous },
    meta: {source: actionSources[actionTypes.TOGGLE_DROPDOWN]}
  };
}

/*
 * relating to async action creator doAppInit
 */

export function initRequest() {
  return {
    type: actionTypes.INIT_APP_REQUEST,
    meta: {source: actionSources[actionTypes.INIT_APP_REQUEST]}
  };
}

export function initSuccess(session) {
  return {
    type: actionTypes.INIT_APP_SUCCESS,
    meta: {source: actionSources[actionTypes.INIT_APP_SUCCESS]}
  };
}

export function initFailure() {
  return {
    type: actionTypes.INIT_APP_FAILURE,
    error: true,
    payload: new Error(errorText.E_INIT),
    meta: {source: actionSources[actionTypes.INIT_APP_FAILURE]}
  };
}

export function setUserInfoFromToken(results) {
  const { user, profile, memberships } = results;
  return {
    type: actionTypes.SET_USER_INFO_FROM_TOKEN,
    payload: { user, profile, memberships },
    meta: {source: actionSources[actionTypes.SET_USER_INFO_FROM_TOKEN]}
  };
}

/*
 * relating to async action creator doLogin
 */

export function loginRequest() {
  return {
    type: actionTypes.LOGIN_REQUEST,
    meta: {source: actionSources[actionTypes.LOGIN_REQUEST]}
  };
}

export function loginSuccess(results) {
  const { user, profile, memberships } = results;
  return {
    type: actionTypes.LOGIN_SUCCESS,
    payload: { user, profile, memberships },
    meta: {
      source: actionSources[actionTypes.LOGIN_SUCCESS],
      metric: metrics.LOGIN_SUCCESS
    }
  };
}

export function loginFailure(errorCode) {
  return {
    type: actionTypes.LOGIN_FAILURE,
    error: true,
    payload: new Error(getLoginErrorMessage(errorCode)),
    meta: {source: actionSources[actionTypes.LOGIN_FAILURE]}
  };
}

/*
 * relating to side-effect-performing action creators
 * retrieveTargetsFromStorage and putTargetsInStorage
 */

export function putUsersTargetsInStorage() {
  return {
    type: actionTypes.STORING_USERS_TARGETS,
    meta: {source: actionSources[actionTypes.STORING_USERS_TARGETS]}
  };
}

export function retrieveUsersTargetsFromStorage() {
  return {
    type: actionTypes.RETRIEVING_USERS_TARGETS,
    meta: {source: actionSources[actionTypes.RETRIEVING_USERS_TARGETS]}
  };
}

export function setUsersTargets(targets) {
  return {
    type: actionTypes.SET_USERS_TARGETS,
    payload: { targets },
    meta: {source: actionSources[actionTypes.SET_USERS_TARGETS]}
  };
}
