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

import _ from 'lodash'

import Actions from '../actions/'
let { ActionTypes, Pages } = Actions

export function dropdown(state = false, action) {
  switch (action.type) {
    case ActionTypes.TOGGLE_DROPDOWN:
      return action.payload.isVisible
    default:
      return state
  }
}

export function os(state = null, action) {
  switch (action.type) {
    case ActionTypes.SET_OS:
      return action.payload.os
    default:
      return state
  }
}

export function page(state = Pages.LOADING, action) {
  switch (action.type) {
    case ActionTypes.SET_PAGE:
      return action.payload.page
    default:
      return state
  }
}

export function url(state = {}, action) {
  switch (action.type) {
    case ActionTypes.SET_FORGOT_PASSWORD_URL:
      return Object.assign({}, state, {
        forgotPassword: action.payload.url
      })
    case ActionTypes.SET_SIGNUP_URL:
      return Object.assign({}, state, {
        signUp: action.payload.url
      })
    default:
      return state
  }
}

export function users(state = {isFetching: false}, action) {
  switch (action.type) {
    case ActionTypes.LOGIN_REQUEST:
      return Object.assign({}, _.omit(state, 'errorMessage'), {isFetching: true})
    case ActionTypes.LOGIN_DONE:
      if (action.error) {
        return Object.assign({}, state, {
          isFetching: false,
          errorMessage: action.payload.message
        })
      }
      const { user, profile, memberships } = action.payload
      let newState = Object.assign({}, _.omit(state, 'errorMessage'), {
        isFetching: false,
        loggedInUser: user.userid
      })
      memberships.map(function(mship) {
        newState[mship.userid] = (mship.userid === user.userid) ?
          Object.assign({}, _.omit(user, 'userid'), profile) :
          Object.assign({}, mship.profile)
      })
      return newState
    default:
      return state
  }
}

export function version(state = null, action) {
  switch (action.type) {
    case ActionTypes.SET_VERSION:
      return action.payload.version
    default:
      return state
  }
}
