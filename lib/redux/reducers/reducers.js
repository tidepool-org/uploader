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

import _ from 'lodash';

import * as actionTypes from '../constants/actionTypes';
import { pages } from '../constants/otherConstants';

import initialDevices from './devices';

export function devices(state = initialDevices, action) {
  switch (action.type) {
    case actionTypes.HIDE_UNAVAILABLE_DEVICES:
      if (action.payload.os === 'mac') {
        const unavailableOnMac = [
          'precisionxtra',
          'abbottfreestylelite',
          'abbottfreestylefreedomlite'
        ];
        let filteredDevices = {};
        _.each(state, function(device) {
          if (!_.includes(unavailableOnMac, device.key)) {
            filteredDevices[device.key] = device;
          }
        });
        return filteredDevices;
      }
      return Object.assign({}, state);
    default:
      return state;
  }
}

export function dropdown(state = false, action) {
  switch (action.type) {
    case actionTypes.TOGGLE_DROPDOWN:
      return action.payload.isVisible;
    default:
      return state;
  }
}

export function os(state = null, action) {
  switch (action.type) {
    case actionTypes.SET_OS:
      return action.payload.os;
    default:
      return state;
  }
}

export function page(state = pages.LOADING, action) {
  switch (action.type) {
    case actionTypes.SET_PAGE:
      return action.payload.page;
    default:
      return state;
  }
}

export function url(state = {}, action) {
  switch (action.type) {
    case actionTypes.SET_FORGOT_PASSWORD_URL:
      return Object.assign({}, state, {
        forgotPassword: action.payload.url
      });
    case actionTypes.SET_SIGNUP_URL:
      return Object.assign({}, state, {
        signUp: action.payload.url
      });
    default:
      return state;
  }
}

export function users(state = {isFetching: false}, action) {
  function setLoggedInUser(payload) {
    const { user, profile, memberships } = payload;
    let newState = Object.assign({}, _.omit(state, 'errorMessage'), {
      isFetching: false,
      loggedInUser: user.userid,
      targetsForUpload: [],
      uploadTargetUser: null
    });
    _.each(memberships, function(mship) {
      newState[mship.userid] = (mship.userid === user.userid) ?
        Object.assign({}, _.omit(user, 'userid'), profile) :
        Object.assign({}, mship.profile);
      // only push the logged-in user's userid to targetsForUpload if logged-in user a PWD
      if (mship.userid === user.userid && profile.patient != null) {
        newState.targetsForUpload.push(user.userid);
      }
      else if (mship.userid !== user.userid) {
        newState.targetsForUpload.push(mship.userid);
      }
    });
    // if logged-in user is PWD, they are default for upload
    if (profile.patient != null) {
      newState.uploadTargetUser = user.userid;
    }
    // when logged-in user is not PWD but only has access to upload for one user
    else if (newState.targetsForUpload.length === 1) {
      newState.uploadTargetUser = newState.targetsForUpload[0];
    }
    return newState;
  }

  switch (action.type) {
    case actionTypes.LOGIN_FAILURE:
      return Object.assign({}, state, {
        isFetching: false,
        errorMessage: action.payload.message
      });
    case actionTypes.LOGIN_REQUEST:
      return Object.assign({}, _.omit(state, 'errorMessage'), {isFetching: true});
    case actionTypes.LOGIN_SUCCESS:
      return setLoggedInUser(action.payload);
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      return setLoggedInUser(action.payload);
    default:
      return state;
  }
}

export function version(state = null, action) {
  switch (action.type) {
    case actionTypes.SET_VERSION:
      return action.payload.version;
    default:
      return state;
  }
}
