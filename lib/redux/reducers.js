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

import { combineReducers } from 'redux'
import Actions from './actions/'
let { ActionTypes, Pages } = Actions

const { LOADING } = Pages

function dropdown(state = false, action) {
  switch (action.type) {
    case ActionTypes.TOGGLE_DROPDOWN:
      return action.payload.isVisible
    default:
      return state
  }
}

function os(state = null, action) {
  switch (action.type) {
    case ActionTypes.SET_OS:
      return action.payload.os
    default:
      return state
  }
}

function page(state = LOADING, action) {
  switch (action.type) {
    case ActionTypes.SET_PAGE:
      return action.payload.page
    default:
      return state
  }
}

function url(state = {}, action) {
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

function users(state = {isFetching: false}, action) {
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
      memberships.map(function(member) {
        newState[member.userid] = (member.userid === user.userid) ?
          Object.assign({}, _.omit(user, 'userid'), profile) :
          Object.assign({}, member.profile)
      })
      return newState
    default:
      return state
  }
}

function version(state = null, action) {
  switch (action.type) {
    case ActionTypes.SET_VERSION:
      return action.payload.version
    default:
      return state
  }
}

const uploader = combineReducers({dropdown, os, page, version, url, users})

export default uploader