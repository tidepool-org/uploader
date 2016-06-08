/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2016, Tidepool Project
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

export function allUsers(state = {}, action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      const { user, profile, memberships } = action.payload;
      let newState = {};
      _.each(memberships, (membership) => {
        newState[membership.userid] = (membership.userid === user.userid) ?
          Object.assign({}, _.omit(user, 'userid'), profile) :
          Object.assign({}, membership.profile);
      });
      return newState;
    case actionTypes.LOGOUT_REQUEST:
      return {};
    default:
      return state;
  }
}

export function loggedInUser(state = null, action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      const { user } = action.payload;
      return user.userid;
    case actionTypes.LOGOUT_REQUEST:
      return null;
    default:
      return state;
  }
}

export function loginErrorMessage(state = null, action) {
  switch (action.type) {
    case actionTypes.LOGIN_FAILURE:
      const err = action.payload;
      return err.message;
    case actionTypes.LOGIN_REQUEST:
      return null;
    default:
      return state;
  }
}

export function updateProfileErrorMessage(state = null, action) {
  switch (action.type) {
    case actionTypes.UPDATE_PROFILE_FAILURE:
      const err = action.payload;
      return err.message;
    case actionTypes.UPDATE_PROFILE_REQUEST:
      return null;
    default:
      return state;
  }
}

export function updateProfileErrorDismissed(state = null, action) {
  switch (action.type) {
    case actionTypes.UPDATE_PROFILE_REQUEST:
      return null;
    case actionTypes.DISMISS_UPDATE_PROFILE_ERROR:
      return true;
    default:
      return state;
  }
}

function isPwd(membership) {
  return !_.isEmpty(_.get(membership, ['profile', 'patient'], {}));
}

export function targetDevices(state = {}, action) {
  switch (action.type) {
    case actionTypes.ADD_TARGET_DEVICE: {
      const { userId, deviceKey } = action.payload;
      return update(
        state,
        {[userId]: {$apply: (devicesArray) => {
          if (devicesArray == null) {
            return [deviceKey];
          }
          else if (!_.includes(devicesArray, deviceKey)) {
            let newDevices = devicesArray.slice(0);
            newDevices.push(deviceKey);
            return newDevices;
          }
          else {
            return devicesArray;
          }
        }}}
      );
    }
    // create some scaffolding based on the users the loggedInUser
    // currently has upload access to
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN: {
      const { memberships } = action.payload;
      let newState = {};
      _.each(memberships, (membership) => {
        if (isPwd(membership)) {
          newState[membership.userid] = _.get(membership, ['profile', 'patient', 'targetDevices'], []);
        }
      });
      return newState;
    }
    case actionTypes.LOGOUT_REQUEST:
      return {};
    case actionTypes.REMOVE_TARGET_DEVICE: {
      const { userId, deviceKey } = action.payload;
      return update(
        state,
        {[userId]: {$apply: (devices) => {
          return _.filter(devices, (device) => {
            return device !== deviceKey;
          });
        }}}
      );
    }
    case actionTypes.SET_USERS_TARGETS: {
      const { targets } = action.payload;
      let newState = state;
      _.forOwn(targets, (targetsArray, userId) => {
        if (newState[userId] != null) {
          const targetDevices = _.pluck(targetsArray, 'key');
          newState = update(
            newState,
            {[userId]: {$set: targetDevices}}
          );
        }
      });
      return newState;
    }
    case actionTypes.STORING_USERS_TARGETS:
      // _.omit returns a new object, doesn't mutate
      return _.omit(state, 'noUserSelected');

    default:
      return state;
  }
}

export function targetTimezones(state = {}, action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      const { memberships } = action.payload;
      let newState = {};
      _.each(memberships, (membership) => {
        if (isPwd(membership)) {
          newState[membership.userid] = _.get(membership, ['profile', 'patient', 'targetTimezone'], null);
        }
      });
      return newState;
    case actionTypes.LOGOUT_REQUEST:
      return {};
    case actionTypes.SET_TARGET_TIMEZONE: {
      const { userId, timezoneName } = action.payload;
      return update(
        state,
        {[userId]: {$set: timezoneName}}
      );
    }
    case actionTypes.SET_USERS_TARGETS: {
      const { targets } = action.payload;
      let newState = state;
      _.forOwn(targets, (targetsArray, userId) => {
        // we have to check *specifically* for undefined here
        // because we use null when there isn't a timezone
        if (newState[userId] !== undefined) {
          const targetTimezones = _.uniq(_.pluck(targetsArray, 'timezone'));
          if (targetTimezones.length === 1) {
            newState = update(
              newState,
              {[userId]: {$set: targetTimezones[0]}}
            );
          }
          // if different timezones are stored for different devices
          // we set to `null` to force the user to choose again
          else {
            newState = update(
              newState,
              {[userId]: {$set: null}}
            );
          }
        }
      });
      return newState;
    }
    case actionTypes.STORING_USERS_TARGETS:
      // _.omit returns a new object, doesn't mutate
      return _.omit(state, 'noUserSelected');
    default:
      return state;
  }
}

export function targetUsersForUpload(state = [], action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      const { user, profile, memberships } = action.payload;
      let newState = [];
      _.each(memberships, (membership) => {
        if (membership.userid === user.userid) {
          if (!_.isEmpty(profile.patient)) {
            newState.push(membership.userid);
          }
        }
        else {
          newState.push(membership.userid);
        }
      });
      return newState;
    case actionTypes.LOGOUT_REQUEST:
      return [];
    default:
      return state;
  }
}

export function uploadTargetUser(state = null, action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
      const { user, profile, memberships } = action.payload;
      const uploadMemberships = _.filter(memberships, (mship) => {
        return !_.isEmpty(_.get(mship, ['profile', 'patient']));
      });
      if (!_.isEmpty(profile.patient)) {
        return user.userid;
      }
      else if (uploadMemberships.length === 1) {
        return uploadMemberships[0].userid;
      }
      else {
        return null;
      }
    case actionTypes.SET_UPLOAD_TARGET_USER:
      const { userId } = action.payload;
      return userId;
    case actionTypes.LOGOUT_REQUEST:
      return null;
    default:
      return state;
  }
}
