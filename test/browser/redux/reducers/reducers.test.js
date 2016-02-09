/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2015-2016, Tidepool Project
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

import _ from 'lodash';

import * as actionTypes from '../../../../lib/redux/constants/actionTypes';
import { pages, steps } from '../../../../lib/redux/constants/otherConstants';
import * as reducers from '../../../../lib/redux/reducers/reducers';

import devices from '../../../../lib/redux/reducers/devices';

import { UnsupportedError } from '../../../../lib/redux/utils/errors';

let pwd = require('../../fixtures/pwd.json');
let nonpwd = require('../../fixtures/nonpwd.json');

describe('reducers', () => {
  describe('devices', () => {
    function filterDevicesFn(os) {
      return function(device) {
        if (device.enabled[os] === true) {
          return true;
        }
        return false;
      };
    }
    it('should return the initial state', () => {
      expect(reducers.devices(undefined, {})).to.deep.equal(devices);
    });

    it('should handle HIDE_UNAVAILABLE_DEVICES [mac]', () => {
      let actualResult = reducers.devices(undefined, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'mac'}
      });
      let expectedResult = _.pick(devices, filterDevicesFn('mac'));
      expect(actualResult).to.deep.equal(expectedResult);
      // because we do currently have devices unavailable on Mac
      expect(Object.keys(actualResult).length).to.be.lessThan(Object.keys(devices).length);
      // test to be sure not *mutating* state object but rather returning new!
      let prevState = devices;
      let resultState = reducers.devices(prevState, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'mac'}
      });
      expect(prevState === resultState).to.be.false;
    });

    it('should handle HIDE_UNAVAILABLE_DEVICES [win]', () => {
      let actualResult = reducers.devices(undefined, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'win'}
      });
      let expectedResult = _.pick(devices, filterDevicesFn('win'));
      expect(actualResult).to.deep.equal(expectedResult);
      // because nothing currently is unavailable on Windows
      expect(Object.keys(actualResult).length).to.equal(Object.keys(devices).length);
      // test to be sure not *mutating* state object but rather returning new!
      let prevState = devices;
      let resultState = reducers.devices(prevState, {
        type: actionTypes.HIDE_UNAVAILABLE_DEVICES,
        payload: {os: 'win'}
      });
      expect(prevState === resultState).to.be.false;
    });
  });

  describe('dropdown', () => {
    it('should return the initial state', () => {
      expect(reducers.dropdown(undefined, {})).to.be.false;
    });

    it('should handle TOGGLE_DROPDOWN', () => {
      expect(reducers.dropdown(undefined, {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: true}
      })).to.be.true;
      expect(reducers.dropdown(undefined, {
        type: actionTypes.TOGGLE_DROPDOWN,
        payload: {isVisible: false}
      })).to.be.false;
    });

    it('should handle LOGOUT_REQUEST', () => {
      expect(reducers.dropdown(undefined, {
        type: actionTypes.LOGOUT_REQUEST
      })).to.be.false;
      expect(reducers.dropdown(true, {
        type: actionTypes.LOGOUT_REQUEST
      })).to.be.false;
      expect(reducers.dropdown(false, {
        type: actionTypes.LOGOUT_REQUEST
      })).to.be.false;
    });
  });

  describe('os', () => {
    it('should return the initial state', () => {
      expect(reducers.os(undefined, {})).to.be.null;
    });

    it('should handle SET_OS', () => {
      expect(reducers.os(undefined, {
        type: actionTypes.SET_OS,
        payload: {os: 'test'}
      })).to.equal('test');
    });
  });

  describe('page', () => {
    it('should return the initial state', () => {
      expect(reducers.page(undefined, {})).to.equal(pages.LOADING);
    });

    it('should handle SET_PAGE', () => {
      expect(reducers.page(undefined, {
        type: actionTypes.SET_PAGE,
        payload: {page: 'main'}
      })).to.equal('main');
    });
  });

  describe('unsupported', () => {
    it('should return the initial state', () => {
      expect(reducers.unsupported(undefined, {})).to.be.true;
    });

    it('should handle INIT_APP_FAILURE', () => {
      const err = new Error('Offline!');
      expect(reducers.unsupported(undefined, {
        type: actionTypes.INIT_APP_FAILURE,
        error: true,
        payload: err
      })).to.deep.equal(err);
    });

    it('should handle VERSION_CHECK_FAILURE [API error]', () => {
      const err = new Error('API error!');
      expect(reducers.unsupported(undefined, {
        type: actionTypes.VERSION_CHECK_FAILURE,
        error: true,
        payload: err
      })).to.deep.equal(err);
    });

    it('should handle VERSION_CHECK_FAILURE [uploader version doesn\'t meet minimum]', () => {
      const currentVersion = '0.99.0', requiredVersion = '0.100.0';
      const err = new UnsupportedError(currentVersion, requiredVersion);
      expect(reducers.unsupported(undefined, {
        type: actionTypes.VERSION_CHECK_FAILURE,
        error: true,
        payload: err
      })).to.be.true;
    });

    it('should handle VERSION_CHECK_SUCCESS', () => {
      expect(reducers.unsupported(undefined, {
        type: actionTypes.VERSION_CHECK_SUCCESS
      })).to.be.false;
    });
  });

  describe('blipUrls', () => {
    it('should return the initial state', () => {
      expect(reducers.blipUrls(undefined, {})).to.deep.equal({});
    });

    it('should handle SET_BLIP_VIEW_DATA_URL', () => {
      const VIEW_DATA_LINK = 'http://www.acme.com/patients/a1b2c3/data';
      const actionPayload = {url: VIEW_DATA_LINK};
      expect(reducers.blipUrls(undefined, {
        type: actionTypes.SET_BLIP_VIEW_DATA_URL,
        payload: actionPayload
      }).viewDataLink).to.equal(VIEW_DATA_LINK);
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {};
      let finalState = reducers.blipUrls(initialState, {
        type: actionTypes.SET_BLIP_VIEW_DATA_URL,
        payload: actionPayload
      });
      expect(initialState === finalState).to.be.false;
    });

    it('should handle SET_FORGOT_PASSWORD_URL', () => {
      const FORGOT_PWD = 'http://www.acme.com/forgot-password';
      const actionPayload = {url: FORGOT_PWD};
      expect(reducers.blipUrls(undefined, {
        type: actionTypes.SET_FORGOT_PASSWORD_URL,
        payload: actionPayload
      }).forgotPassword).to.equal(FORGOT_PWD);
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {};
      let finalState = reducers.blipUrls(initialState, {
        type: actionTypes.SET_FORGOT_PASSWORD_URL,
        payload: actionPayload
      });
      expect(initialState === finalState).to.be.false;
    });

    it('should handle SET_SIGNUP_URL', () => {
      const SIGN_UP = 'http://www.acme.com/sign-up';
      const actionPayload = {url: SIGN_UP};
      expect(reducers.blipUrls(undefined, {
        type: actionTypes.SET_SIGNUP_URL,
        payload: actionPayload
      }).signUp).to.equal(SIGN_UP);
      // test to be sure not *mutating* state object but rather returning new!
      let initialState = {};
      let finalState = reducers.blipUrls(initialState, {
        type: actionTypes.SET_SIGNUP_URL,
        payload: actionPayload
      });
      expect(initialState === finalState).to.be.false;
    });
  });

  describe('version', () => {
    it('should return the initial state', () => {
      expect(reducers.version(undefined, {})).to.be.null;
    });

    it('should handle SET_VERSION', () => {
      expect(reducers.version(undefined, {
        type: actionTypes.SET_VERSION,
        payload: {version: '0.100.0'}
      })).to.deep.equal('0.100.0');
    });
  });

  describe('working', () => {
    it('should return the initial state', () => {
      expect(reducers.working(undefined, {})).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle INIT_APP_FAILURE', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.INIT_APP_FAILURE
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: false,
        uploading: false
      });
    });

    it('should handle INIT_APP_REQUEST', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.INIT_APP_REQUEST
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle INIT_APP_SUCCESS', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.INIT_APP_SUCCESS
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: false,
        uploading: false
      });
    });

    it('should handle LOGIN_FAILURE', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.LOGIN_FAILURE
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle LOGIN_REQUEST', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.LOGIN_REQUEST
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: true,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle LOGIN_SUCCESS', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.LOGIN_SUCCESS
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle READ_FILE_ABORTED', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.READ_FILE_ABORTED
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle READ_FILE_FAILURE', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.READ_FILE_FAILURE
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle VERSION_CHECK_FAILURE', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.VERSION_CHECK_FAILURE
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle VERSION_CHECK_REQUEST', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.VERSION_CHECK_REQUEST
      })).to.deep.equal({
        checkingVersion: true,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle VERSION_CHECK_SUCCESS', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.VERSION_CHECK_SUCCESS
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle UPLOAD_FAILURE', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.UPLOAD_FAILURE
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });

    it('should handle UPLOAD_REQUEST', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.UPLOAD_REQUEST
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: true
      });
    });

    it('should handle UPLOAD_SUCCESS', () => {
      expect(reducers.working(undefined, {
        type: actionTypes.UPLOAD_SUCCESS
      })).to.deep.equal({
        checkingVersion: false,
        fetchingUserInfo: false,
        initializingApp: true,
        uploading: false
      });
    });
  });
});