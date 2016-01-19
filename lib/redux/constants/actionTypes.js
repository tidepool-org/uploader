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

/**
 * Syncronous action types
 */
export const ADD_TARGET_DEVICE = 'ADD_TARGET_DEVICE';
export const HIDE_UNAVAILABLE_DEVICES = 'HIDE_UNAVAILABLE_DEVICES';
export const REMOVE_TARGET_DEVICE = 'REMOVE_TARGET_DEVICE';
export const RETRIEVING_USERS_TARGETS = 'RETRIEVING_USERS_TARGETS';
export const SET_DEFAULT_TARGET_ID = 'SET_DEFAULT_TARGET_ID';
export const SET_FORGOT_PASSWORD_URL = 'SET_FORGOT_PASSWORD_URL';
export const SET_OS = 'SET_OS';
export const SET_PAGE = 'SET_PAGE';
export const SET_SIGNUP_URL = 'SET_SIGNUP_URL';
export const SET_TARGET_TIMEZONE = 'SET_TARGET_TIMEZONE';
export const SET_USER_INFO_FROM_TOKEN = 'SET_USER_INFO_FROM_TOKEN';
export const SET_USERS_TARGETS = 'SET_USERS_TARGETS';
export const SET_VERSION = 'SET_VERSION';
export const STORING_USERS_TARGETS = 'STORING_USERS_TARGETS';
export const TOGGLE_DROPDOWN = 'TOGGLE_DROPDOWN';

/*
 * Asyncronous action types
 */

export const INIT_APP_REQUEST = 'INIT_APP_REQUEST';
export const INIT_APP_SUCCESS = 'INIT_APP_SUCCESS';
export const INIT_APP_FAILURE = 'INIT_APP_FAILURE';

// user.login
export const LOGIN_REQUEST = 'LOGIN_REQUEST';
export const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
export const LOGIN_FAILURE = 'LOGIN_FAILURE';
