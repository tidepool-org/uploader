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
import update from 'immutability-helper';
import personUtils from '../../lib/core/personUtils';

import * as actionTypes from '../constants/actionTypes';

export function allUsers(state = {}, action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
    case actionTypes.SET_ALL_USERS: {
      const { user, profile, memberships } = action.payload;
      let newState = {};
      _.each(memberships, (membership) => {
        newState[membership.userid] = (membership.userid === user.userid) ?
          _.assign({}, _.omit(user, 'userid'), profile) :
          _.assign({}, membership.profile);
      });
      return newState;
    }
    case actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS:
      const { account } = action.payload;
      return update(state, {$merge: {[account.userid]: account.profile}});
    case actionTypes.UPDATE_PROFILE_SUCCESS:
      const { userId, profile } = action.payload;
      return update(state, {$merge: {[userId]: profile}});
    case actionTypes.LOGOUT_REQUEST:
      return {};
    default:
      return state;
  }
}

export function memberships(state = {}, action) {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
    case actionTypes.SET_USER_INFO_FROM_TOKEN:
    case actionTypes.SET_ALL_USERS: {
      const { memberships } = action.payload;
      let newState = {};
      _.each(memberships, (membership) => {
        newState[membership.userid] = _.assign({}, _.omit(membership, ['userid', 'profile']));
      });
      return newState;
    }
    case actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS:
      const { account } = action.payload;
      return update(state, { $merge: { [account.userid]: { permissions: { custodian: {}, upload: {}, view: {} } } } });
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
    case actionTypes.SET_UPLOAD_TARGET_USER:
      return null;
    default:
      return state;
  }
}

export function updateProfileErrorDismissed(state = null, action) {
  switch (action.type) {
    case actionTypes.UPDATE_PROFILE_REQUEST:
    case actionTypes.SET_UPLOAD_TARGET_USER:
      return null;
    case actionTypes.DISMISS_UPDATE_PROFILE_ERROR:
      return true;
    default:
      return state;
  }
}

export function createCustodialAccountErrorMessage(state = null, action) {
  switch (action.type) {
    case actionTypes.CREATE_CUSTODIAL_ACCOUNT_FAILURE:
      const err = action.payload;
      return err.message;
    case actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST:
      return null;
    default:
      return state;
  }
}

export function createCustodialAccountErrorDismissed(state = false, action) {
  switch (action.type) {
    case actionTypes.CREATE_CUSTODIAL_ACCOUNT_REQUEST:
      return false;
    case actionTypes.DISMISS_CREATE_CUSTODIAL_ACCOUNT_ERROR:
      return true;
    default:
      return state;
  }
}

function isPwd(membership) {
  return !_.isEmpty(_.get(membership, ['profile', 'patient'], {}));
}

function isVCA(membership) {
  return personUtils.userHasRole(membership, 'clinic');
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
          let targetDevices = _.get(membership, ['profile', 'patient', 'targetDevices'], []);
          // collapse all bayercontour* devices into bayercontournext
          targetDevices = _.uniq(_.map(targetDevices, function(device) {
            if (device.startsWith('bayercontour') && device.length > 12) {
              return 'bayercontournext';
            }
            if (device === 'abbottfreestylefreedomlite') {
              return 'abbottfreestylelite';
            }
            return device;
          }));
          newState[membership.userid] = targetDevices;
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
          let targetDevices = _.map(targetsArray, 'key');
          // collapse all bayercontour* devices into bayercontournext
          targetDevices = _.uniq(_.map(targetDevices, function(device) {
            if (device.startsWith('bayercontour') && device.length > 12) {
              return 'bayercontournext';
            }
            if (device === 'abbottfreestylefreedomlite') {
              return 'abbottfreestylelite';
            }
            return device;
          }));
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
          const targetTimezones = _.uniq(_.map(targetsArray, 'timezone'));
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
    case actionTypes.SET_ALL_USERS:
      const { user, profile, memberships } = action.payload;
      let newState = [];
      _.each(memberships, (membership) => {
        if (membership.userid === user.userid) {
          if (!isVCA(user) && !_.isEmpty(profile.patient)){
            newState.push(membership.userid);
          }
        } else {
          newState.push(membership.userid);
        }
      });
      return newState;
    case actionTypes.CREATE_CUSTODIAL_ACCOUNT_SUCCESS:
      const { account } = action.payload;
      return update(state, {$push: [account.userid]});
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
      else if (uploadMemberships.length === 1 && !isVCA(user)) {
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
