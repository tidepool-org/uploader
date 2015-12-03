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

export const Paths = {
  FORGOT_PASSWORD: '#/request-password-from-uploader',
  SIGNUP: '#/signup'
}