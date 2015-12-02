import _ from 'lodash'

import { combineReducers } from 'redux'
import { ActionTypes, Pages } from './actions'

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
      const { user, profile, careteam } = action.payload
      let newState = Object.assign({}, _.omit(state, 'errorMessage'), {
        isFetching: false,
        loggedInUser: user.userid
      })
      careteam.map(function(member) {
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