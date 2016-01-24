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

/* global chrome */

import _ from 'lodash';
import async from 'async';

import sundial from 'sundial';

import * as actionTypes from '../constants/actionTypes';
import * as actionSources from '../constants/actionSources';
import { pages, paths, steps, urls } from '../constants/otherConstants';
import { errorText } from '../utils/errors';

import * as syncActions from './sync';

let services = {};
let versionInfo = {};

/*
 * ASYNCHRONOUS ACTION CREATORS
 */

export function doAppInit(config, servicesToInit) {
  return function(dispatch) {
    dispatch(syncActions.setVersion(config.version));
    services = servicesToInit;
    versionInfo.semver = config.version;
    versionInfo.name = config.namedVersion;
    const { api, carelink, device, localStore, log } = services;

    dispatch(syncActions.initRequest());

    async.series([
      (cb) => {
        log('Initializing local store.');
        localStore.init(localStore.getInitialState(), () => { cb(); });
      },
      (cb) => {
        if (typeof chrome !== 'undefined') {
          chrome.runtime.getPlatformInfo(function(platformInfo) {
            dispatch(syncActions.setOs(platformInfo.os));
            log('Retrieved operating system info:', platformInfo.os);
            dispatch(syncActions.hideUnavailableDevices(platformInfo.os));
            cb();
          });
        }
      },
      (cb) => {
        log('Initializing device');
        device.init({
          api,
          version: config.namedVersion
        }, cb);
      },
      (cb) => {
        log('Initializing CareLink');
        carelink.init({ api }, cb);
      },
      (cb) => {
        log(`Initializing api`);
        api.init(cb);
      },
      (cb) => {
        log('Setting all api hosts');
        api.setHosts(_.pick(config, ['API_URL', 'UPLOAD_URL', 'BLIP_URL']));
        dispatch(syncActions.setForgotPasswordUrl(api.makeBlipUrl(paths.FORGOT_PASSWORD)));
        dispatch(syncActions.setSignUpUrl(api.makeBlipUrl(paths.SIGNUP)));
        cb();
      }
    ], function(err, results) {
      if (err) {
        // TODO: surface this error in UI or at least via metric call?
        return dispatch(syncActions.initFailure());
      }
      let session = results[4];
      if (session === undefined) {
        dispatch(syncActions.setPage(pages.LOGIN));
        dispatch(syncActions.initSuccess());
        return;
      }

      async.series([
        api.user.account,
        api.user.profile,
        api.user.getUploadGroups
      ], function(err, results) {
        if (err) {
          // TODO: surface this error in UI or at least via metric call?
          return dispatch(syncActions.initFailure());
        }
        // remove env-switching context menu after login
        if (typeof chrome !== 'undefined') {
          services.log('Removing Chrome context menu');
          chrome.contextMenus.removeAll();
        }
        dispatch(syncActions.initSuccess());
        dispatch(syncActions.setUserInfoFromToken({
          user: results[0],
          profile: results[1],
          memberships: results[2]
        }));
        dispatch(retrieveTargetsFromStorage());
      });
    });
  };
}

export function doLogin(creds, opts) {
  return function(dispatch) {
    const { api } = services;
    dispatch(syncActions.loginRequest());

    async.series([
      api.user.login.bind(null, creds, opts),
      api.user.profile,
      api.user.getUploadGroups
    ], function(err, results) {
      if (err) {
        return dispatch(syncActions.loginFailure(err.status));
      }
      // remove env-switching context menu after login
      if (typeof chrome !== 'undefined') {
        services.log('Removing Chrome context menu');
        chrome.contextMenus.removeAll();
      }
      dispatch(syncActions.loginSuccess({
        user: results[0].user,
        profile: results[1],
        memberships: results[2]
      }));
      dispatch(retrieveTargetsFromStorage());
    });
  };
}

export function doLogout() {
  return function(dispatch) {
    const { api } = services;
    dispatch(syncActions.logoutRequest());
    api.user.logout(function(err) {
      if (err) {
        dispatch(syncActions.logoutFailure());
        dispatch(syncActions.setPage(pages.LOGIN, actionSources.USER));
      }
      else {
        dispatch(syncActions.logoutSuccess());
        dispatch(syncActions.setPage(pages.LOGIN, actionSources.USER));
      }
    });
  };
}

export function doDeviceUpload(driverId, utc) {
  return function (dispatch, getState) {
    const { device } = services;
    const { devices, os, url, users, version } = getState();
    var targetDevice = _.findWhere(devices, {source : {driverId: driverId}});
    dispatch(syncActions.deviceDetectRequest());
    const opts = {
      targetId: users.uploadTargetUser,
      timezone: users[users.uploadTargetUser].targets.timezone,
      // TODO: wire in action creator for updating progress
      progress: _.noop,
      version: version
    };
    const { uploads } = getState();
    device.detect(driverId, opts, (err, dev) => {
      if (err) {
        let errProps = {
          step: _.get(uploads, ['uploadInProgress', 'progress', 'step'], null),
          utc: _.isEmpty(utc) ? sundial.utcDateString() : utc,
          version: version
        };
        if ((os === 'mac' && _.get(targetDevice, ['showDriverLink', os], false) === true) ||
          (os === 'win' && _.get(targetDevice, ['showDriverLink', os], false) === true)) {
          // TODO: attach driverLink to error message to surface in UI
          let err = new Error(`You may need to install the ${targetDevice.name} device driver.`);
          errProps.code = 'E_DRIVER';
          err.driverLink = urls.DRIVER_DOWNLOAD;
          // allow to pass in error time for testing
          return dispatch(syncActions.uploadFailure(err, errProps, targetDevice));
        }
        else {
          let err = new Error(errorText.E_DEVICE_DETECT);
          errProps.code = 'E_DEVICE_DETECT';
          // allow to pass in error time for testing
          return dispatch(syncActions.uploadFailure(err, errProps, targetDevice));
        }
      }
    });
  };
}

export function doUpload(deviceKey, utc) {
  return function (dispatch, getState) {
    const { devices, uploads, users } = getState();
    if (uploads.uploadInProgress === true) {
      return dispatch(syncActions.uploadAborted());
    }

    const uploadTargetUser = users.uploadTargetUser;
    dispatch(syncActions.uploadRequest(uploadTargetUser, devices[deviceKey], utc));

    let targetDevice = devices[deviceKey];
    let deviceType = targetDevice.source.type;

    if (_.includes(['device', 'block'], deviceType)) {
      dispatch(doDeviceUpload(targetDevice.source.driverId, utc));
    }
  };
}

/*
 * COMPLEX ACTION CREATORS
 */

function getUploadsByUser(targetsByUser) {
  let uploadsByUser = _.mapValues(targetsByUser, function(targets) {
    let uploads = {};
    _.each(targets, function(target) {
      uploads[target.key] = {history: []};
    });
    return uploads;
  });

  return uploadsByUser;
}

export function putTargetsInStorage() {
  return function(dispatch, getState) {
    const { users } = getState();
    let usersWithTargets = {};
    _.forOwn(users, function(value, key) {
      if (!_.isEmpty(value.targets)) {
        usersWithTargets[key] = value;
      }
    });
    const { localStore } = services;
    dispatch(syncActions.retrieveUsersTargetsFromStorage());
    const devicesInStorage = localStore.getItem('devices') || {};
    let targetsByUser = {};
    _.forOwn(usersWithTargets, function(userObj, userId) {
      const targets = userObj.targets;
      const timezone = targets.timezone;
      let targetsToStore = [];
      _.each(targets.devices, function(device) {
        targetsToStore.push({key: device, timezone: timezone});
      });
      targetsByUser[userId] = targetsToStore;
    });
    dispatch(syncActions.putUsersTargetsInStorage());
    localStore.setItem(
      'devices',
      Object.assign({}, devicesInStorage, targetsByUser)
    );

    if (!_.isEmpty(users[users.uploadTargetUser].targets.timezone) &&
      !_.isEmpty(users[users.uploadTargetUser].targets.devices)) {
      dispatch(syncActions.setPage(pages.MAIN));
    }

    const uploadsByUser = getUploadsByUser(targetsByUser);

    dispatch(syncActions.setUploads(uploadsByUser));
  };
}

export function retrieveTargetsFromStorage() {
  return function(dispatch, getState) {
    const { devices, users } = getState();
    const { localStore } = services;
    dispatch(syncActions.retrieveUsersTargetsFromStorage());
    const targets = localStore.getItem('devices');
    if (targets === null) {
      return dispatch(syncActions.setPage(pages.SETTINGS));
    }
    else {
      const uploadsByUser = getUploadsByUser(targets);

      dispatch(syncActions.setUploads(uploadsByUser));
    }
    dispatch(syncActions.setUsersTargets(targets));

    if (targets[users.uploadTargetUser] != null) {
      const userTargets = targets[users.uploadTargetUser];
      const targetDeviceKeys = _.pluck(userTargets, 'key');
      const supportedDeviceKeys = Object.keys(devices);
      const atLeastOneDeviceSupportedOnSystem = _.some(targetDeviceKeys, function(key) {
        return _.includes(supportedDeviceKeys, key);
      });
      let timezones = [];
      _.each(userTargets, function(target) {
        if (target.timezone) {
          timezones.push(target.timezone);
        }
      });
      let uniqTimezones = [];
      if (!_.isEmpty(timezones)) {
        uniqTimezones = _.uniq(timezones);
      }
      if (uniqTimezones.length === 1 && atLeastOneDeviceSupportedOnSystem) {
        return dispatch(syncActions.setPage(pages.MAIN));
      }
      else {
        return dispatch(syncActions.setPage(pages.SETTINGS));
      }
    }
    dispatch(syncActions.setPage(pages.SETTINGS));
  };
}

export function setUploadTargetUserAndMaybeRedirect(targetId) {
  return function(dispatch, getState) {
    const { devices, users } = getState();
    dispatch(syncActions.setUploadTargetUser(targetId));
    const targetDevices = _.get(users, [targetId, 'targets', 'devices'], []);
    const targetTimezone = _.get(users, [targetId, 'targets', 'timezone'], null);
    const supportedDeviceKeys = Object.keys(devices);
    const atLeastOneDeviceSupportedOnSystem = _.some(targetDevices, function(key) {
      return _.includes(supportedDeviceKeys, key);
    });
    if (_.isEmpty(targetDevices) || _.isEmpty(targetTimezone)) {
      return dispatch(syncActions.setPage(pages.SETTINGS));
    }
    if (!atLeastOneDeviceSupportedOnSystem) {
      return dispatch(syncActions.setPage(pages.SETTINGS));
    }
  };
}
