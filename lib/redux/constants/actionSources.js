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

const USER = 'USER';
const USER_VISIBLE = 'USER_VISIBLE';
const UNDER_THE_HOOD = 'UNDER_THE_HOOD';

/**
 * Syncronous action types
 */
export const HIDE_UNAVAILABLE_DEVICES = USER_VISIBLE;
export const SET_DEFAULT_TARGET_ID = USER_VISIBLE;
export const SET_FORGOT_PASSWORD_URL = USER_VISIBLE;
export const SET_SIGNUP_URL = USER_VISIBLE;
export const SET_OS = USER_VISIBLE;
export const SET_PAGE = USER_VISIBLE;
export const SET_USER_INFO_FROM_TOKEN = USER_VISIBLE;
export const SET_USERS_TARGETS = USER_VISIBLE;
export const SET_VERSION = USER_VISIBLE;
export const TOGGLE_DROPDOWN = USER;

/*
 * Asyncronous action types
 */

export const INIT_APP_REQUEST = UNDER_THE_HOOD;
export const INIT_APP_SUCCESS = UNDER_THE_HOOD;
export const INIT_APP_FAILURE = USER_VISIBLE;

// user.login
export const LOGIN_REQUEST = USER;
export const LOGIN_SUCCESS = USER_VISIBLE;
export const LOGIN_FAILURE = USER_VISIBLE;
