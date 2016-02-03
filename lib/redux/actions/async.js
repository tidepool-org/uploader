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
import semver from 'semver';
import stacktrace from 'stack-trace';

import sundial from 'sundial';

import * as actionTypes from '../constants/actionTypes';
import * as actionSources from '../constants/actionSources';
import { pages, paths, steps, urls } from '../constants/otherConstants';
import { errorText } from '../utils/errors';

import * as syncActions from './sync';

let services = {};
let versionInfo = {};
let daysForCareLink = null;

/*
 * ASYNCHRONOUS ACTION CREATORS
 */

export function doAppInit(config, servicesToInit) {
  return (dispatch, getState) => {
    dispatch(syncActions.setVersion(config.version));
    services = servicesToInit;
    versionInfo.semver = config.version;
    versionInfo.name = config.namedVersion;
    daysForCareLink = config.DEFAULT_CARELINK_DAYS;
    const { api, carelink, device, localStore, log } = services;

    dispatch(syncActions.initRequest());

    async.series([
      (cb) => {
        log('Initializing local store.');
        localStore.init(localStore.getInitialState(), () => { cb(); });
      },
      (cb) => {
        if (typeof chrome !== 'undefined') {
          chrome.runtime.getPlatformInfo((platformInfo) => {
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
    ], (err, results) => {
      if (err) {
        // TODO: surface this error in UI or at least via metric call?
        return dispatch(syncActions.initFailure());
      }
      let session = results[4];
      if (session === undefined) {
        dispatch(syncActions.setPage(pages.LOGIN));
        dispatch(syncActions.initSuccess());
        return dispatch(doVersionCheck());
      }

      async.series([
        api.user.account,
        api.user.profile,
        api.user.getUploadGroups
      ], (err, results) => {
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
        dispatch(doVersionCheck());
        dispatch(syncActions.setUserInfoFromToken({
          user: results[0],
          profile: results[1],
          memberships: results[2]
        }));
        const { users } = getState();
        if (users.uploadTargetUser !== null) {
          dispatch(syncActions.setBlipViewDataUrl(
            api.makeBlipUrl(viewDataPathForUser(users.uploadTargetUser))
          ));
        }
        dispatch(retrieveTargetsFromStorage());
      });
    });
  };
}

function viewDataPathForUser(uploadTargetUser) {
  return `/patients/${uploadTargetUser}/data`;
}

export function doLogin(creds, opts) {
  return (dispatch, getState) => {
    const { api } = services;
    dispatch(syncActions.loginRequest());

    async.series([
      api.user.login.bind(null, creds, opts),
      api.user.profile,
      api.user.getUploadGroups
    ], (err, results) => {
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
      const { users } = getState();
      if (users.uploadTargetUser !== null) {
        dispatch(syncActions.setBlipViewDataUrl(
          api.makeBlipUrl(viewDataPathForUser(users.uploadTargetUser))
        ));
      }
      dispatch(retrieveTargetsFromStorage());
    });
  };
}

export function doLogout() {
  return (dispatch) => {
    const { api } = services;
    dispatch(syncActions.logoutRequest());
    api.user.logout((err) => {
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

function getUtc(utc) {
  return _.isEmpty(utc) ? sundial.utcDateString() : utc;
}

function makeProgressFn(dispatch, step, percentage) {
  return (step, percentage) => {
    dispatch(syncActions.uploadProgress(step, percentage));
  };
}

function makeUploadCb(dispatch, getState, errCode, utc) {
  return (err, recs) => {
    const { devices, uploads, users, version } = getState();
    const targetDevice = devices[uploads.uploadInProgress.pathToUpload[1]];
    if (err) {
      const serverDown = 'Origin is not allowed by Access-Control-Allow-Origin';
      let displayErr = new Error(err.message === serverDown ?
        errorText.E_SERVER_DOWN : errorText[errCode]);
      let uploadErrProps = {
        details: err.message,
        utc: getUtc(utc),
        name: err.name || 'API POST error',
        step: err.step || null,
        code: errCode,
        version: version
      };

      uploadErrProps.stringifiedStack = _.pluck(
        _.filter(
          stacktrace.parse(err),
          (cs) => { return cs.functionName !== null; }
        ),
        'functionName'
      ).join(', ');
      return dispatch(syncActions.uploadFailure(displayErr, uploadErrProps, targetDevice));
    }
    const currentUpload = _.get(uploads, [users.uploadTargetUser, targetDevice.key], {});
    dispatch(syncActions.uploadSuccess(users.uploadTargetUser, targetDevice, currentUpload, recs, utc));

  };
}

export function doCareLinkUpload(deviceKey, creds, utc) {
  return (dispatch, getState) => {
    const { api, carelink } = services;
    const { devices, users, version } = getState();

    const uploadTargetUser = users.uploadTargetUser;
    const targetDevice = devices[deviceKey];

    dispatch(syncActions.fetchCareLinkRequest(uploadTargetUser, deviceKey));

    api.upload.fetchCarelinkData({
      carelinkUsername: creds.username,
      carelinkPassword: creds.password,
      daysAgo: daysForCareLink,
      targetUserId: uploadTargetUser
    }, (err, data) => {
      if (err) {
        let fetchErr = new Error(errorText.E_FETCH_CARELINK);
        let fetchErrProps = {
          details: err.message,
          utc: getUtc(utc),
          code: 'E_FETCH_CARELINK',
          version: version
        };
        dispatch(syncActions.fetchCareLinkFailure(errorText.E_FETCH_CARELINK));
        return dispatch(syncActions.uploadFailure(fetchErr, fetchErrProps, targetDevice));
      }
      if (data.search(/302 Moved Temporarily/) !== -1) {
        let credsErr = new Error(errorText.E_CARELINK_CREDS);
        let credsErrProps = {
          utc: getUtc(utc),
          code: 'E_CARELINK_CREDS',
          version: version
        };
        dispatch(syncActions.fetchCareLinkFailure(errorText.E_CARELINK_CREDS));
        return dispatch(syncActions.uploadFailure(credsErr, credsErrProps, targetDevice));
      }
      dispatch(syncActions.fetchCareLinkSuccess());

      const opts = {
        targetId: users.uploadTargetUser,
        timezone: users[users.uploadTargetUser].targets.timezone,
        progress: makeProgressFn(dispatch),
        version: version
      };
      carelink.upload(data, opts, makeUploadCb(dispatch, getState, 'E_CARELINK_UPLOAD', utc));
    });
  };
}

export function doDeviceUpload(driverId, utc) {
  return (dispatch, getState) => {
    const { device } = services;
    const { devices, os, users, version } = getState();
    const targetDevice = _.findWhere(devices, {source: {driverId: driverId}});
    dispatch(syncActions.deviceDetectRequest());
    const opts = {
      targetId: users.uploadTargetUser,
      timezone: users[users.uploadTargetUser].targets.timezone,
      progress: makeProgressFn(dispatch),
      version: version
    };
    const { uploads } = getState();
    const currentUpload = _.get(
      uploads,
      [users.uploadTargetUser, targetDevice.key],
      {}
    );
    if (currentUpload.file) {
      opts.filedata = currentUpload.file.data;
      opts.filename = currentUpload.file.name;
    }

    device.detect(driverId, opts, (err, dev) => {
      if (err) {
        if ((os === 'mac' && _.get(targetDevice, ['showDriverLink', os], false) === true) ||
          (os === 'win' && _.get(targetDevice, ['showDriverLink', os], false) === true)) {
          let displayErr = new Error(`You may need to install the ${targetDevice.name} device driver.`);
          let driverLinkErrProps = {
            details: err.message,
            utc: getUtc(utc),
            code: 'E_DRIVER',
            version: version
          };
          displayErr.driverLink = urls.DRIVER_DOWNLOAD;
          return dispatch(syncActions.uploadFailure(displayErr, driverLinkErrProps, targetDevice));
        }
        else {
          let displayErr = new Error(errorText.E_SERIAL_CONNECTION);
          let deviceDetectErrProps = {
            details: err.message,
            utc: getUtc(utc),
            code: 'E_SERIAL_CONNECTION',
            version: version
          };
          return dispatch(syncActions.uploadFailure(displayErr, deviceDetectErrProps, targetDevice));
        }
      }

      if (!dev && opts.filename == null) {
        let displayErr = new Error(errorText.E_HID_CONNECTION);
        let disconnectedErrProps = {
          utc: getUtc(utc),
          code: 'E_HID_CONNECTION',
          version: version
        };
        return dispatch(syncActions.uploadFailure(displayErr, disconnectedErrProps, targetDevice));
      }

      device.upload(driverId, opts, makeUploadCb(dispatch, getState, 'E_DEVICE_UPLOAD', utc));
    });
  };
}

export function doUpload(deviceKey, opts, utc) {
  return (dispatch, getState) => {
    const { devices, uploads, users } = getState();
    if (uploads.uploadInProgress === true) {
      return dispatch(syncActions.uploadAborted());
    }

    const uploadTargetUser = users.uploadTargetUser;
    dispatch(syncActions.uploadRequest(uploadTargetUser, devices[deviceKey], utc));

    const targetDevice = devices[deviceKey];
    const deviceType = targetDevice.source.type;

    if (_.includes(['device', 'block'], deviceType)) {
      dispatch(doDeviceUpload(targetDevice.source.driverId, utc));
    }
    else if (deviceType === 'carelink') {
      dispatch(doCareLinkUpload(deviceKey, opts, utc));
    }
  };
}

export function readFile(userId, deviceKey, file, extension) {
  return (dispatch, getState) => {
    if (!file) {
      return;
    }
    dispatch(syncActions.choosingFile(userId, deviceKey));
    const { version } = getState();

    if (file.name.slice(-extension.length) !== extension) {
      let err = new Error(errorText.E_FILE_EXT + extension);
      let errProps = {
        code: 'E_FILE_EXT',
        version: version
      };
      return dispatch(syncActions.readFileAborted(err, errProps));
    }
    else {
      let reader = new FileReader();
      reader.onloadstart = () => {
        dispatch(syncActions.readFileRequest(file.name));
      };

      reader.onerror = () => {
        let err = new Error(errorText.E_READ_FILE + file.name);
        let errProps = {
          code: 'E_READ_FILE',
          version: version
        };
        return dispatch(syncActions.readFileFailure(err, errProps));
      };

      reader.onloadend = ((theFile) => {
        return (e) => {
          dispatch(syncActions.readFileSuccess(userId, deviceKey, e.srcElement.result));
          dispatch(doUpload(deviceKey));
        };
      })(file);

      reader.readAsArrayBuffer(file);
    }
  };
}

export function doVersionCheck() {
  return (dispatch, getState) => {
    dispatch(syncActions.versionCheckRequest());
    const { api } = services;
    let { version } = getState();
    api.upload.getVersions((err, versions) => {
      if (err) {
        return dispatch(syncActions.versionCheckFailure(err));
      }
      const { uploaderMinimum } = versions;
      // if either the version from the jellyfish response
      // or the local uploader version is somehow and invalid semver
      // we will catch the error and dispatch versionCheckFailure
      try {
        const upToDate = semver.gte(version, uploaderMinimum);
        if (!upToDate) {
          return dispatch(syncActions.versionCheckFailure(null, version, uploaderMinimum));
        }
        else {
          return dispatch(syncActions.versionCheckSuccess());
        }
      }
      catch(err) {
        return dispatch(syncActions.versionCheckFailure(err));
      }
    });
  };
}

/*
 * COMPLEX ACTION CREATORS
 */

function getUploadsByUser(targetsByUser) {
  let uploadsByUser = _.mapValues(targetsByUser, (targets) => {
    let uploads = {};
    _.each(targets, (target) => {
      uploads[target.key] = {history: []};
    });
    return uploads;
  });

  return uploadsByUser;
}

export function putTargetsInStorage() {
  return (dispatch, getState) => {
    const { users } = getState();
    let usersWithTargets = {};
    _.forOwn(users, (value, key) => {
      if (!_.isEmpty(value.targets)) {
        usersWithTargets[key] = value;
      }
    });
    const { localStore } = services;
    dispatch(syncActions.retrieveUsersTargetsFromStorage());
    const devicesInStorage = localStore.getItem('devices') || {};
    let targetsByUser = {};
    _.forOwn(usersWithTargets, (userObj, userId) => {
      const targets = userObj.targets;
      const timezone = targets.timezone;
      let targetsToStore = [];
      _.each(targets.devices, (device) => {
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
  return (dispatch, getState) => {
    const { devices, users } = getState();
    const { api, localStore } = services;
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
      const atLeastOneDeviceSupportedOnSystem = _.some(targetDeviceKeys, (key) => {
        return _.includes(supportedDeviceKeys, key);
      });
      let timezones = [];
      _.each(userTargets, (target) => {
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
  return (dispatch, getState) => {
    const { devices, users } = getState();
    dispatch(syncActions.setUploadTargetUser(targetId));
    const { api } = services;
    dispatch(syncActions.setBlipViewDataUrl(
      api.makeBlipUrl(viewDataPathForUser(targetId))
    ));
    const targetDevices = _.get(users, [targetId, 'targets', 'devices'], []);
    const targetTimezone = _.get(users, [targetId, 'targets', 'timezone'], null);
    const supportedDeviceKeys = Object.keys(devices);
    const atLeastOneDeviceSupportedOnSystem = _.some(targetDevices, (key) => {
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
