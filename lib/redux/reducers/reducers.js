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
import update from 'react-addons-update';

import * as actionTypes from '../constants/actionTypes';
import { pages } from '../constants/otherConstants';

import initialDevices from './devices';

export function devices(state = initialDevices, action) {
  switch (action.type) {
    case actionTypes.HIDE_UNAVAILABLE_DEVICES:
      function filterOutUnavailable(os) {
        let filteredDevices = {};
        _.each(state, function(device) {
          if (device.enabled[os] === true) {
            filteredDevices[device.key] = device;
          }
        });
        return filteredDevices;
      }
      return filterOutUnavailable(action.payload.os);
    default:
      return state;
  }
}

export function dropdown(state = false, action) {
  switch (action.type) {
    case actionTypes.TOGGLE_DROPDOWN:
      return action.payload.isVisible;
    case actionTypes.LOGOUT_REQUEST:
      return false;
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

export function uploads(state = {}, action) {
  switch (action.type) {
    case actionTypes.SET_UPLOADS:
      const { uploadsByUser } = action.payload;
      return Object.assign({}, state, uploadsByUser);
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

const INITIAL_USERS_STATE = {isFetching: false};

export function users(state = INITIAL_USERS_STATE, action) {
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
    case actionTypes.ADD_TARGET_DEVICE: {
        // using explicit block to avoid const collision
        const { deviceKey, userId } = action.payload;
        let targets = update(
          _.get(state, [userId, 'targets'], {devices: []}),
          {devices: {$apply: (devices) => {
            if (!devices) {
              return [deviceKey];
            }
            else {
              devices.push(deviceKey);
              return _.uniq(devices);
            }
          }}}
        );
        let user = update(
          _.get(state, userId, {}),
          {targets: {$set: targets}}
        );
        return Object.assign({}, state, {[userId]: user});
      }
    case actionTypes.LOGIN_FAILURE:
      return Object.assign({}, state, {
        isFetching: false,
        errorMessage: action.payload.message
      });
    case actionTypes.LOGIN_REQUEST:
      return Object.assign({}, _.omit(state, 'errorMessage'), {isFetching: true});
    case actionTypes.LOGIN_SUCCESS:
      return setLoggedInUser(action.payload);
    case actionTypes.LOGOUT_REQUEST:
      return Object.assign({}, INITIAL_USERS_STATE);
    case actionTypes.REMOVE_TARGET_DEVICE: {
        // using explicit block to avoid const collision
        const { deviceKey, userId } = action.payload;
        let user = _.get(state, userId, null);
        if (user !== null) {
          user = update(
            user,
            {targets: {devices: {$apply: (devices) => {
              return _.filter(devices, function(device) {
                return device !== deviceKey;
              });
            }}}}
          );
          return Object.assign({}, state, {[userId]: user});
        }
        return Object.assign({}, state);
      }
    case actionTypes.SET_TARGET_TIMEZONE: {
        // using explicit block to avoid const collision
        const { timezoneName, userId } = action.payload;
        let targets = update(
          _.get(state, [userId, 'targets'], {timezone: null}),
          {timezone: {$set: timezoneName}}
        );
        let user = update(
          _.get(state, userId, {}),
          {targets: {$set: targets}}
        );
        return Object.assign({}, state, {[userId]: user});
      }
    case actionTypes.SET_UPLOAD_TARGET_USER: {
        // using explicit block to avoid const collision
        const { userId } = action.payload;
        return Object.assign({}, state, {uploadTargetUser: userId});
      }
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      return setLoggedInUser(action.payload);
    case actionTypes.SET_USERS_TARGETS:
      function getTargetTimezone(deviceList) {
        var uniqTimezones = _.uniq(_.pluck(deviceList, 'timezone'));
        if (uniqTimezones.length === 1) {
          return uniqTimezones[0];
        }
        // if we find more than one timezone or 0 timezones, we return null
        // and you'll get sent back to the settings page (or stay there)
        else {
          return null;
        }
      }
      const { users } = state;
      const { targets } = action.payload;
      let newState = {};
      _.forOwn(targets, function(userTargets, userId) {
        if (state[userId]) {
          newState[userId] = update(
            state[userId],
            {
              targets: {$set: {
                devices: _.pluck(userTargets, 'key'),
                timezone: getTargetTimezone(userTargets)
              }}
            }
          );
        }
      });
      return Object.assign({}, state, newState);
    case actionTypes.STORING_USERS_TARGETS:
      return Object.assign({}, _.omit(state, 'noUserSelected'));
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
