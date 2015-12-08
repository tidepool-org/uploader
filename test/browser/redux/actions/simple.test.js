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

import { ActionSources, ActionTypes } from '../../../../lib/redux/actions/constants'
import * as SimpleActions from '../../../../lib/redux/actions/simple'
import { ErrorText } from '../../../../lib/redux/errors'

describe('simple actions', () => {
  describe('hideUnavailableDevices', () => {
    it('should create an action to hide devices unavailable on given operating system', () => {
      const OS = 'test'
      const expectedAction = {
        type: ActionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: OS},
        meta: {source: ActionSources[ActionTypes.HIDE_UNAVAILABLE_DEVICES]}
      }
      expect(SimpleActions.hideUnavailableDevices(OS)).to.deep.equal(expectedAction)
      expect(isFSA(SimpleActions.hideUnavailableDevices(OS))).to.be.true
    })
  })

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

  describe('for doAppInit', () => {
    describe('initRequest', () => {
      it('should create an action to record the start of app initialization', () => {
        const expectedAction = {
          type: ActionTypes.INIT_APP_REQUEST,
          meta: {source: ActionSources[ActionTypes.INIT_APP_REQUEST]}
        }
        expect(SimpleActions.initRequest()).to.deep.equal(expectedAction)
        expect(isFSA(SimpleActions.initRequest())).to.be.true
      })
    })

    describe('initDone', () => {
      it('should create an action to record the successful completion of app initialization', () => {
        const expectedAction = {
          type: ActionTypes.INIT_APP_DONE,
          meta: {source: ActionSources[ActionTypes.INIT_APP_DONE]}
        }
        expect(SimpleActions.initDone()).to.deep.equal(expectedAction)
        expect(isFSA(SimpleActions.initDone())).to.be.true
      })
    })

    describe('initError', () => {
      it('should create an action to record early exit from app initialization due to error', () => {
        const expectedAction = {
          type: ActionTypes.INIT_APP_DONE,
          error: true,
          payload: new Error(ErrorText.E_INIT),
          meta: {source: ActionSources[ActionTypes.INIT_APP_DONE]}
        }
        expect(SimpleActions.initError()).to.deep.equal(expectedAction)
        expect(isFSA(SimpleActions.initError())).to.be.true
      })
    })
  })

  describe('for doLogin', () => {
    describe('loginRequest', () => {
      it('should create an action to record the start of user login', () => {
        const expectedAction = {
          type: ActionTypes.LOGIN_REQUEST,
          meta: {source: ActionSources[ActionTypes.LOGIN_REQUEST]}
        }
        expect(SimpleActions.loginRequest()).to.deep.equal(expectedAction)
        expect(isFSA(SimpleActions.loginRequest())).to.be.true
      })
    })

    describe('loginDone', () => {
      it('should create an action to set the logged-in user (plus user\'s profile, careteam memberships)', () => {
        // NB: this is not what these objects actually look like
        // actual shape is irrelevant to testing action creators
        const user = {userid: 'abc123'}
        const profile = {fullName: 'Jane Doe'}
        const memberships = [{userid: 'def456'}, {userid: 'ghi789'}]
        const expectedAction = {
          type: ActionTypes.LOGIN_DONE,
          payload: { user, profile, memberships },
          meta: {source: ActionSources[ActionTypes.LOGIN_DONE]}
        }
        expect(SimpleActions.loginDone({ user, profile, memberships })).to.deep.equal(expectedAction)
        expect(isFSA(SimpleActions.loginDone({ user, profile, memberships }))).to.be.true
      })
    })

    describe('loginError', () => {
      it('should create an action to report a login error', () => {
        const err = 'Login error!'
        SimpleActions.__Rewire__('getLoginErrorMessage', () => err)
        const expectedAction = {
          type: ActionTypes.LOGIN_DONE,
          error: true,
          payload: new Error(err),
          meta: {source: ActionSources[ActionTypes.LOGIN_DONE]}
        }
        expect(SimpleActions.loginError(err)).to.deep.equal(expectedAction)
        expect(isFSA(SimpleActions.loginError(err))).to.be.true
        SimpleActions.__ResetDependency__('getLoginErrorMessage')
      })
    })
  })
})