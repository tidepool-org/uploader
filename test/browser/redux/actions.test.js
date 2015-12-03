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

import { isFSA } from 'flux-standard-action'

import { ActionSources, ActionTypes } from '../../../lib/redux/actions/constants'
import * as SimpleActions from '../../../lib/redux/actions/simple'

describe('actions', () => {
  describe('setForgotPasswordUrl', () => {
    it('should create an action to set the forgot password url', () => {
      const URL = 'http://www.acme.com/forgot-password'
      const expectedAction = {
        type: ActionTypes.SET_FORGOT_PASSWORD_URL,
        payload: {url: URL},
        meta: {source: ActionSources[ActionTypes.SET_FORGOT_PASSWORD_URL]}
      }
      expect(SimpleActions.setForgotPasswordUrl(URL)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.setForgotPasswordUrl(URL))).to.be.true
    })
  })

  describe('setSignUpUrl', () => {
    it('should create an action to set the sign-up url', () => {
      const URL = 'http://www.acme.com/sign-up'
      const expectedAction = {
        type: ActionTypes.SET_SIGNUP_URL,
        payload: {url: URL},
        meta: {source: ActionSources[ActionTypes.SET_SIGNUP_URL]}
      }
      expect(SimpleActions.setSignUpUrl(URL)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.setSignUpUrl(URL))).to.be.true
    })
  })

  describe('setOs', () => {
    it('should create an action to set the operating system', () => {
      const OS = 'mac'
      const expectedAction = {
        type: ActionTypes.SET_OS,
        payload: {os: OS},
        meta: {source: ActionSources[ActionTypes.SET_OS]}
      }
      expect(SimpleActions.setOs(OS)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.setOs(OS))).to.be.true
    })
  })

  describe('setPage', () => {
    it('should create an action to set the page', () => {
      const PAGE = 'FOO'
      const expectedAction = {
        type: ActionTypes.SET_PAGE,
        payload: {page: PAGE},
        meta: {source: ActionSources[ActionTypes.SET_PAGE]}
      }
      expect(SimpleActions.setPage(PAGE)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.setPage(PAGE))).to.be.true
    })
  })

  describe('setVersion', () => {
    it('should create an action to set the uploader version', () => {
      const VERSION = '0.100.0'
      const expectedAction = {
        type: ActionTypes.SET_VERSION,
        payload: {version: VERSION},
        meta: {source: ActionSources[ActionTypes.SET_VERSION]}
      }
      expect(SimpleActions.setVersion(VERSION)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.setVersion(VERSION))).to.be.true
    })
  })

  describe('toggleDropdown', () => {
    it('should create an action to toggle the dropdown menu', () => {
      const DROPDOWN_PREVIOUS_STATE = true
      const expectedAction = {
        type: ActionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false},
        meta: {source: ActionSources[ActionTypes.TOGGLE_DROPDOWN]}
      }
      expect(SimpleActions.toggleDropdown(DROPDOWN_PREVIOUS_STATE)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.toggleDropdown(DROPDOWN_PREVIOUS_STATE))).to.be.true
    })
  })
})