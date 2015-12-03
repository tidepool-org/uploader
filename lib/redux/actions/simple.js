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

import { ActionTypes, Pages, Paths } from './constants'

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