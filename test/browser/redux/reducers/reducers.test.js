/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
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

/*eslint-env mocha*/

import _ from 'lodash'

import { ActionTypes, Pages } from '../../../../lib/redux/actions/constants'
import * as reducers from '../../../../lib/redux/reducers/reducers'

let pwd = require('../../fixtures/pwd.json')
let nonpwd = require('../../fixtures/nonpwd.json')

describe('reducers', () => {
  describe('dropdown', () => {
    it('should return the initial state', () => {
      expect(reducers.dropdown(undefined, {})).to.be.false
    })

    it('should handle TOGGLE_DROPDOWN', () => {
      expect(reducers.dropdown(undefined, {
        type: ActionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: true}
      })).to.be.true
      expect(reducers.dropdown(undefined, {
        type: ActionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false}
      })).to.be.false
    })
  })

  describe('os', () => {
    it('should return the initial state', () => {
      expect(reducers.os(undefined, {})).to.be.null
    })

    it('should handle SET_OS', () => {
      expect(reducers.os(undefined, {
        type: ActionTypes.SET_OS,
        payload: {os: 'test'}
      })).to.equal('test')
    })
  })

  describe('page', () => {
    it('should return the initial state', () => {
      expect(reducers.page(undefined, {})).to.equal(Pages.LOADING)
    })

    it('should handle SET_PAGE', () => {
      expect(reducers.page(undefined, {
        type: ActionTypes.SET_PAGE,
        payload: {page: 'main'}
      })).to.equal('main')
    })
  })

  describe('users', () => {
    it('should return the initial state', () => {
      expect(reducers.users(undefined, {})).to.deep.equal({isFetching: false})
    })

    it('should handle LOGIN_REQUEST', () => {
      expect(reducers.users(undefined, {
        type: ActionTypes.LOGIN_REQUEST
      })).to.deep.equal({isFetching: true})
      // test to be sure not *mutating* state object but rather returning new!
      let prevState = {isFetching: false}
      let resultState = reducers.users(prevState, {
        type: ActionTypes.LOGIN_REQUEST
      })
      expect(prevState === resultState).to.be.false
    })

    it('should handle LOGIN_DONE [no error, logged-in PWD]', () => {
      let resultState = {
        isFetching: false,
        loggedInUser: pwd.user.userid,
        [pwd.user.userid]: _.assign({}, _.omit(pwd.user, 'userid'), pwd.profile)
      }
      pwd.memberships.slice(1).map(function(mship) {
        resultState[mship.userid] = _.assign({}, mship.profile)
      })
      const actionPayload = {
        user: pwd.user,
        profile: pwd.profile,
        memberships: pwd.memberships
      }
      expect(reducers.users(undefined, {
        type: ActionTypes.LOGIN_DONE,
        payload: actionPayload
      })).to.deep.equal(resultState)
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {isFetching: true}
      let finalState = reducers.users(initialState, {
        type: ActionTypes.LOGIN_DONE,
        payload: actionPayload
      })
      expect(initialState === finalState).to.be.false
    })

    it('should handle LOGIN_DONE [no error, logged-in non-PWD]', () => {
      let resultState = {
        isFetching: false,
        loggedInUser: nonpwd.user.userid,
        [nonpwd.user.userid]: _.assign({}, _.omit(nonpwd.user, 'userid'), nonpwd.profile)
      }
      nonpwd.memberships.slice(1).map(function(mship) {
        resultState[mship.userid] = _.assign({}, mship.profile)
      })
      const actionPayload = {
        user: nonpwd.user,
        profile: nonpwd.profile,
        memberships: nonpwd.memberships
      }
      expect(reducers.users(undefined, {
        type: ActionTypes.LOGIN_DONE,
        payload: actionPayload
      })).to.deep.equal(resultState)
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {isFetching: true}
      let finalState = reducers.users(initialState, {
        type: ActionTypes.LOGIN_DONE,
        payload: actionPayload
      })
      expect(initialState === finalState).to.be.false
    })

    it('should handle LOGIN_DONE [with error]', () => {
      const errMsg = 'Error logging in!'
      expect(reducers.users(undefined, {
        type: ActionTypes.LOGIN_DONE,
        error: true,
        payload: new Error(errMsg)
      })).to.deep.equal({
        isFetching: false,
        errorMessage: errMsg
      })
      // test to be sure not *mutating* state object but rather returning new!
      let prevState = {isFetching: true}
      let resultState = reducers.users(prevState, {
        type: ActionTypes.LOGIN_DONE,
        error: true,
        payload: new Error(errMsg)
      })
      expect(prevState === resultState).to.be.false
    })
  })

  describe('version', () => {
    it('should return the initial state', () => {
      expect(reducers.version(undefined, {})).to.be.null
    })

    it('should handle SET_VERSION', () => {
      expect(reducers.version(undefined, {
        type: ActionTypes.SET_VERSION,
        payload: {version: '0.100.0'}
      })).to.deep.equal('0.100.0')
    })
  })
})