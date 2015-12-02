import { combineReducers } from 'redux'
import { SET_OS, SET_PAGE, Pages } from './actions.js'
const { LOADING } = Pages

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

const uploader = combineReducers({os, page})

export default uploader