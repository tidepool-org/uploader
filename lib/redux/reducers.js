import { combineReducers } from 'redux'
import {
  SET_FORGOT_PASSWORD_URL,
  SET_OS, SET_PAGE,
  SET_VERSION,
  TOGGLE_DROPDOWN,
  Pages
} from './actions.js'

const { LOADING } = Pages

function dropdown(state = false, action) {
  switch (action.type) {
    case TOGGLE_DROPDOWN:
      return action.payload.isVisible
    default:
      return state
  }
}

function os(state = null, action) {
  switch (action.type) {
    case SET_OS:
      return action.payload.os
    default:
      return state
  }
}

function page(state = LOADING, action) {
  switch (action.type) {
    case SET_PAGE:
      return action.payload.page
    default:
      return state
  }
}

function url(state = {}, action) {
  switch (action.type) {
    case SET_FORGOT_PASSWORD_URL:
      return Object.assign({}, state, {
        forgotPassword: action.payload.url
      })
    default:
      return state
  }
}

function version(state = null, action) {
  switch (action.type) {
    case SET_VERSION:
      return action.payload.version
    default:
      return state
  }
}

const uploader = combineReducers({dropdown, os, page, version, url})

export default uploader