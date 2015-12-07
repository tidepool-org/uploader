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

/*
 * ACTION TYPES
 */

export const ActionTypes = {
  HIDE_UNAVAILABLE_DEVICES: 'HIDE_UNAVAILABLE_DEVICES',
  INIT_APP_REQUEST: 'INIT_APP_REQUEST',
  INIT_APP_DONE: 'INIT_APP_DONE',
  LOGIN_REQUEST: 'LOGIN_REQUEST',
  LOGIN_DONE: 'LOGIN_DONE',
  SET_DEFAULT_TARGET_ID: 'SET_DEFAULT_TARGET_ID',
  SET_FORGOT_PASSWORD_URL: 'SET_FORGOT_PASSWORD_URL',
  SET_SIGNUP_URL: 'SET_SIGNUP_URL',
  SET_OS: 'SET_OS',
  SET_PAGE: 'SET_PAGE',
  SET_VERSION: 'SET_VERSION',
  TOGGLE_DROPDOWN: 'TOGGLE_DROPDOWN'
}

const USER = 'USER'
const USER_VISIBLE = 'USER_VISIBLE'
const UNDER_THE_HOOD = 'UNDER_THE_HOOD'

export const ActionSources = {
  HIDE_UNAVAILABLE_DEVICES: USER_VISIBLE,
  INIT_APP_REQUEST: UNDER_THE_HOOD,
  INIT_APP_DONE: UNDER_THE_HOOD,
  LOGIN_REQUEST: USER,
  LOGIN_DONE: UNDER_THE_HOOD,
  SET_DEFAULT_TARGET_ID: USER_VISIBLE,
  SET_FORGOT_PASSWORD_URL: USER_VISIBLE,
  SET_SIGNUP_URL: USER_VISIBLE,
  SET_OS: UNDER_THE_HOOD,
  SET_PAGE: UNDER_THE_HOOD,
  SET_VERSION: USER_VISIBLE,
  TOGGLE_DROPDOWN: USER
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

export const Paths = {
  FORGOT_PASSWORD: '#/request-password-from-uploader',
  SIGNUP: '#/signup'
}