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

import async from 'async';
import { push } from 'connected-react-router';
import _ from 'lodash';
import semver from 'semver';
import { get, set, del } from 'idb-keyval';

import { checkCacheValid } from 'redux-cache';
import { ipcRenderer } from '../utils/ipc';

import * as actionSources from '../constants/actionSources';
import * as actionTypes from '../constants/actionTypes';
import ErrorMessages from '../constants/errorMessages';
import * as metrics from '../constants/metrics';
import { pages, pagesMap, paths } from '../constants/otherConstants';

import api from '../../lib/core/api';
import driverManifests from '../../lib/core/driverManifests';
import localStore from '../../lib/core/localStore';
import personUtils from '../../lib/core/personUtils';
import { clinicUIDetails } from '../../lib/core/clinicUtils';
import * as sync from './sync';
import * as actionUtils from './utils';
import env from '../utils/env';

let services = { api };
let versionInfo = {};
let hostMap = {
  'macOS': 'mac',
  'Windows' : 'win',
  'Linux': 'linux',
};

const isBrowser = typeof window !== 'undefined';
let win = isBrowser ? window : null;

function createActionError(usrErrMessage, apiError) {
  const err = new Error(usrErrMessage);
  if (apiError) {
    err.originalError = apiError;
    if (apiError.status){
      err.status = apiError.status;
    }
  }
  return err;
}

/**
 * cacheByIdOptions
 *
 * Sets the options used by redux-cache for a given id. This allows us to selectively cache parts of
 * a nested data store, such as our allUsersMap, which stores nested data by patient ID
 *
 * @param {String} id - The ID to use for the cache key
 * @returns {Object} The options object
 */
 function cacheByIdOptions(id) {
  return {
    accessStrategy: (state, reducerKey, cacheKey) => {
      return _.get(state, [reducerKey, cacheKey], null);
    },
    cacheKey: `${id}_cacheUntil`,
  };
};

/*
 * ASYNCHRONOUS ACTION CREATORS
 */

export function doAppInit(opts, servicesToInit) {
  return async (dispatch, getState) => {
    // when we are developing with hot reload, we get into trouble if we try to initialize the app
    // when it's already been initialized, so we check the working.initializingApp flag first
    if (getState().working.initializingApp.inProgress === false) {
      console.log('App already initialized! Skipping initialization.');
      return;
    }
    services = servicesToInit;
    versionInfo.semver = opts.version;
    versionInfo.name = opts.namedVersion;
    const { api, device, log } = services;

    dispatch(sync.initializeAppRequest());
    log('Platform detected:', navigator.userAgentData.platform);
    dispatch(sync.hideUnavailableDevices(opts.os || hostMap[navigator.userAgentData.platform]));

    log('Getting OS details.');
    await actionUtils.initOSDetails();

    ipcRenderer.on('bluetooth-pairing-request', async (event, details) => {
      const displayBluetoothModal = actionUtils.makeDisplayBluetoothModal(
        dispatch
      );
      displayBluetoothModal((response) => {
        ipcRenderer.send('bluetooth-pairing-response', response);
      }, details);
    });

    log('Initializing device');
    device.init({
      api,
      version: opts.namedVersion,
      uploaderDestination: opts.uploaderDestination,
    }, function(deviceError, deviceResult){
      if (deviceError) {
        return dispatch(sync.initializeAppFailure(deviceError));
      }
      log('Initializing api');
      api.init(function(apiError, apiResult){
        if (apiError) {
          return dispatch(sync.initializeAppFailure(apiError));
        }
        log('Setting all api hosts');
        api.setHosts(_.pick(opts, ['API_URL', 'UPLOAD_URL', 'BLIP_URL', 'environment']));
        dispatch(sync.setForgotPasswordUrl(api.makeBlipUrl(paths.FORGOT_PASSWORD)));
        dispatch(sync.setSignUpUrl(api.makeBlipUrl(paths.SIGNUP)));
        dispatch(sync.setNewPatientUrl(api.makeBlipUrl(paths.NEW_PATIENT)));
        dispatch(sync.setBlipUrl(api.makeBlipUrl('/')));
        let session = apiResult;
        if (session === undefined) {
          dispatch(setPage(pages.LOGIN));
          dispatch(sync.initializeAppSuccess());
          return dispatch(doVersionCheck());
        }

        api.user.initializationInfo((err, results) => {
          const [ user, profile, memberships, associatedAccounts, clinics ] = results;
          if (err) {
            return dispatch(sync.initializeAppFailure(err));
          }
          dispatch(sync.initializeAppSuccess());
          dispatch(doVersionCheck());
          dispatch(sync.setUserInfoFromToken({
            user: user,
            profile: profile,
            memberships: memberships,
            clinics: clinics,
          }));
          dispatch(sync.getClinicsForClinicianSuccess(clinics, user.userid));
          const isClinic = personUtils.isClinic(user);
          if(!_.isEmpty(clinics)){
            if (clinics.length == 1) { // select clinic and go to clinic user select page
              let clinicId = _.get(clinics,'0.clinic.id',null);
              dispatch(fetchPatientsForClinic(clinicId));
              dispatch(selectClinic(api, clinicId));
              return dispatch(
                setPage(pages.CLINIC_USER_SELECT, actionSources.USER, {
                  metric: { eventName: metrics.CLINIC_SEARCH_DISPLAYED },
                })
              );
            }
            if (clinics.length > 1) { // more than one clinic - go to workspace switch
              return dispatch(
                setPage(pages.WORKSPACE_SWITCH, actionSources.USER, {
                  metric: { eventName: metrics.WORKSPACE_SWITCH_DISPLAYED}
                })
              );
            }
          }
          if(isClinic){ // "old" style clinic account without new clinic
            return dispatch(
              setPage(pages.CLINIC_USER_SELECT, actionSources.USER, {
                metric: { eventName: metrics.CLINIC_SEARCH_DISPLAYED },
              })
            );
          }
          // detect if a DSA here and redirect to data storage screen
          const { targetUsersForUpload } = getState();
          if (_.isEmpty(targetUsersForUpload)) {
            return dispatch(setPage(pages.NO_UPLOAD_TARGETS));
          }

          const { uploadTargetUser } = getState();
          if (uploadTargetUser !== null) {
            dispatch(sync.setBlipViewDataUrl(
              api.makeBlipUrl(actionUtils.viewDataPathForUser(uploadTargetUser))
            ));
          }
          dispatch(retrieveTargetsFromStorage());
        });
      });
    });
  };
}

export function doLogin(creds, opts) {
  return (dispatch, getState) => {
    const { api } = services;
    if (getState().working.loggingIn.inProgress) {
      return;
    }
    dispatch(sync.loginRequest());
    api.user.loginExtended(creds, opts, (err, results) => {
      if (err) {
        return dispatch(sync.loginFailure(err.status));
      }
      const [{user}, profile, memberships] = results;
      dispatch(fetchAssociatedAccounts(api));

      const isClinic = personUtils.isClinic(user);

      // detect if a VCA here and redirect to clinic user select screen
      dispatch(getClinicsForClinician(api, user.userid, { limit: 1000, offset: 0 }, (err, clinics) => {
        if(err) {
          return dispatch(sync.loginFailure(err));
        }
        dispatch(sync.loginSuccess({
          user,
          profile,
          memberships,
          clinics
        }));
        if(!_.isEmpty(clinics)){
          if (clinics.length === 1) { // select clinic and go to clinic user select page
            let clinicId = _.get(clinics,'0.clinic.id',null);
            dispatch(fetchPatientsForClinic(clinicId));
            dispatch(selectClinic(api, clinicId));
            return dispatch(
              setPage(pages.CLINIC_USER_SELECT, actionSources.USER, {
                metric: { eventName: metrics.CLINIC_SEARCH_DISPLAYED },
              })
            );
          }
          if (clinics.length > 1) { // more than one clinic - go to workspace switch
            return dispatch(
              setPage(pages.WORKSPACE_SWITCH, actionSources.USER, {
                metric: { eventName: metrics.WORKSPACE_SWITCH_DISPLAYED}
              })
            );
          }
        }
        if(isClinic){ // "old" style clinic account without new clinic
          return dispatch(
            setPage(pages.CLINIC_USER_SELECT, actionSources.USER, {
              metric: { eventName: metrics.CLINIC_SEARCH_DISPLAYED },
            })
          );
        }
        // detect if a DSA here and redirect to data storage screen
        const { targetUsersForUpload } = getState();
        if (_.isEmpty(targetUsersForUpload)) {
          return dispatch(setPage(pages.NO_UPLOAD_TARGETS));
        }

        const { uploadTargetUser } = getState();
        if (uploadTargetUser !== null) {
          dispatch(sync.setBlipViewDataUrl(
            api.makeBlipUrl(actionUtils.viewDataPathForUser(uploadTargetUser))
          ));
        }
        dispatch(retrieveTargetsFromStorage());

      }));
    });
  };
}

export function doLogout() {
  return (dispatch) => {
    const { api } = services;
    dispatch(sync.logoutRequest());
    api.user.logout((err) => {
      if (err) {
        dispatch(sync.logoutFailure());
      }
      else {
        dispatch(sync.logoutSuccess());
      }
      dispatch(setPage(pages.LOGIN, actionSources.USER));
    });
  };
}

export function doLoggedOut() {
  return (dispatch, getState) => {
    const { api } = services;
    dispatch(sync.logoutRequest());
    api.user.logout((err) => {
      if (err) {
        dispatch(sync.logoutFailure());
      }
      else {
        dispatch(sync.logoutSuccess());
      }
      dispatch(setPage(pages.LOGGED_OUT, actionSources.USER));
    });
  };
}

export function doDeviceUpload(driverId, opts = {}, utc) {
  return (dispatch, getState) => {
    const { device } = services;
    const version = versionInfo.semver;
    const { devices, os, targetTimezones, uploadTargetUser, uploadsByUser } = getState();
    const targetDevice = _.find(devices, {source: {driverId: driverId}});
    dispatch(sync.deviceDetectRequest());
    _.assign(opts, {
      targetId: uploadTargetUser,
      timezone: targetTimezones[uploadTargetUser],
      progress: actionUtils.makeProgressFn(dispatch),
      displayTimeModal: actionUtils.makeDisplayTimeModal(dispatch),
      displayAdHocModal: actionUtils.makeDisplayAdhocModal(dispatch),
      version: version
    });
    const currentUpload = _.get(
      uploadsByUser,
      [uploadTargetUser, targetDevice.key],
      {}
    );
    if (currentUpload.file) {
      opts.filedata = currentUpload.file.data;
      opts.filename = currentUpload.file.name;
    }

    device.detect(driverId, opts, async (err, dev) => {
      if (err) {
        const { loggedInUser, allUsers, clinics, selectedClinicId } = getState();
        const userEmail = _.get(allUsers, [loggedInUser, 'username'], 'Unknown');
        const name = _.get(allUsers, [loggedInUser, 'profile','fullName'], 'Unknown');
        const clinic = _.get(clinics, selectedClinicId, {});
        const os = actionUtils.getOSDetails();

        let displayErr = new Error(ErrorMessages.E_SERIAL_CONNECTION);
        let deviceDetectErrProps = {
          details: err.message,
          utc: actionUtils.getUtc(utc),
          code: 'E_SERIAL_CONNECTION',
          version: version,
          loggedInUser: loggedInUser,
          userEmail: userEmail,
          userName: name,
          os: os,
          device: driverId,
        };

        if (selectedClinicId) {
          deviceDetectErrProps.clinicId = selectedClinicId;
          deviceDetectErrProps.clinicName = clinic.name;
        }

        if (targetDevice.powerOnlyWarning) {
          displayErr = new Error(ErrorMessages.E_USB_CABLE);
          deviceDetectErrProps.code = 'E_USB_CABLE';
        }

        if (_.get(targetDevice, 'source.driverId', null) === 'Dexcom') {
          displayErr = new Error(ErrorMessages.E_DEXCOM_CONNECTION);
          deviceDetectErrProps.code = 'E_DEXCOM_CONNECTION';
        }

        if (err === 'E_LIBRE2_UNSUPPORTED') {
          displayErr = new Error(ErrorMessages.E_LIBRE2_UNSUPPORTED);
          deviceDetectErrProps.code = 'E_LIBRE2_UNSUPPORTED';
          displayErr.link = 'https://support.tidepool.org/hc/en-us/articles/4413124445972';
          displayErr.linkText = 'Please see this support article.';
        }

        if (err === 'E_G7_UNSUPPORTED') {
          displayErr = new Error(ErrorMessages.E_G7_UNSUPPORTED);
          deviceDetectErrProps.code = 'E_G7_UNSUPPORTED';
        }

        displayErr.originalError = err;
        if (process.env.NODE_ENV !== 'test') {
          deviceDetectErrProps = await actionUtils.sendToRollbar(displayErr, deviceDetectErrProps);
        }
        return dispatch(sync.uploadFailure(displayErr, deviceDetectErrProps, targetDevice));
      }

      if (!dev && opts.filename == null) {
        const { loggedInUser, allUsers, clinics, selectedClinicId } = getState();
        const userEmail = _.get(allUsers, [loggedInUser, 'username'], 'Unknown');
        const name = _.get(allUsers, [loggedInUser, 'profile','fullName'], 'Unknown');
        const clinic = _.get(clinics, selectedClinicId, {});
        const os = actionUtils.getOSDetails();
        let displayErr = new Error(ErrorMessages.E_HID_CONNECTION);
        let disconnectedErrProps = {
          utc: actionUtils.getUtc(utc),
          code: 'E_HID_CONNECTION',
          version: version,
          loggedInUser: loggedInUser,
          userEmail: userEmail,
          userName: name,
          os: os,
          device: driverId,
        };

        if (selectedClinicId) {
          disconnectedErrProps.clinicId = selectedClinicId;
          disconnectedErrProps.clinicName = clinic.name;
        }

        if (targetDevice.powerOnlyWarning) {
          displayErr = new Error(ErrorMessages.E_USB_CABLE);
          disconnectedErrProps.code = 'E_USB_CABLE';
        }

        if (_.get(targetDevice, 'source.driverId', null) === 'Dexcom') {
          displayErr = new Error(ErrorMessages.E_DEXCOM_CONNECTION);
          disconnectedErrProps.code = 'E_DEXCOM_CONNECTION';
        }

        if (process.env.NODE_ENV !== 'test') {
          disconnectedErrProps = await actionUtils.sendToRollbar(displayErr, disconnectedErrProps);
        }
        return dispatch(sync.uploadFailure(displayErr, disconnectedErrProps, targetDevice));
      }

      let errorMessage = 'E_DEVICE_UPLOAD';
      if (_.get(targetDevice, 'source.driverId', null) === 'Medtronic') {
        errorMessage = 'E_MEDTRONIC_UPLOAD';
      } else if (_.get(targetDevice, 'source.driverId', null) === 'BluetoothLE' ||
                 _.get(targetDevice, 'source.driverId', null) === 'OneTouchVerioBLE') {
        errorMessage = 'E_BLUETOOTH_PAIR';
      }

      if (targetDevice.powerOnlyWarning) {
        errorMessage = 'E_USB_CABLE';
      }

      device.upload(
        driverId,
        opts,
        actionUtils.makeUploadCb(dispatch, getState, errorMessage, utc)
      );
    });
  };
}

export function doUpload(deviceKey, opts, utc) {
  return async (dispatch, getState) => {

    const { devices, uploadTargetUser, working } = getState();
    const { log } = services;

    const targetDevice = _.get(devices, deviceKey);
    const driverId = _.get(targetDevice, 'source.driverId');
    const driverManifest = _.get(driverManifests, driverId);

    if (driverManifest && driverManifest.mode === 'serial') {
      dispatch(sync.uploadRequest(uploadTargetUser, devices[deviceKey], utc));

      const filters = driverManifest.usb.map(({vendorId, productId}) => ({
        usbVendorId: vendorId,
        usbProductId: productId
      }));

      try {
        const existingPermissions = await navigator.serial.getPorts();

        for (let i = 0; i < existingPermissions.length; i++) {
          const { usbProductId, usbVendorId } = existingPermissions[i].getInfo();

          for (let j = 0; j < driverManifest.usb.length; j++) {
            if (driverManifest.usb[j].vendorId === usbVendorId
              && driverManifest.usb[j].productId === usbProductId) {
                log('Device has already been granted permission');
                opts.port = existingPermissions[i];
            }
          }
        }

        if (opts.port == null) {
          ipcRenderer.send('setSerialPortFilter', filters);
          opts.port = await navigator.serial.requestPort({ filters: filters });
        }
      } catch (err) {
        // not returning error, as we'll attempt user-space driver instead
        log('Error:', err);
      }
    }

    if (driverManifest && driverManifest.mode === 'HID') {
      dispatch(sync.uploadRequest(uploadTargetUser, devices[deviceKey], utc));

      const filters = driverManifest.usb.map(({vendorId, productId}) => ({
        vendorId,
        productId
      }));

      try {
        const existingPermissions = await navigator.hid.getDevices();

        for (let i = 0; i < existingPermissions.length; i++) {
          for (let j = 0; j < driverManifest.usb.length; j++) {
            if (driverManifest.usb[j].vendorId === existingPermissions[i].vendorId
              && driverManifest.usb[j].productId === existingPermissions[i].productId) {
                log('Device has already been granted permission');
                opts.hidDevice = existingPermissions[i];
            }
          }
        }

        if (opts.hidDevice == null) {
          [opts.hidDevice] = await navigator.hid.requestDevice({ filters: filters });
        }

        if (opts.hidDevice == null) {
          throw new Error('No device was selected.');
        }
      } catch (err) {
        const { loggedInUser, allUsers, clinics, selectedClinicId } = getState();
        const userEmail = _.get(allUsers, [loggedInUser, 'username'], 'Unknown');
        const name = _.get(allUsers, [loggedInUser, 'profile','fullName'], 'Unknown');
        const clinic = _.get(clinics, selectedClinicId, {});
        const os = actionUtils.getOSDetails();
        const version = versionInfo.semver;

        log('Error:', err);

        let hidErr = new Error(ErrorMessages.E_HID_CONNECTION);

        let errProps = {
          details: err.message,
          utc: actionUtils.getUtc(utc),
          code: 'E_HID_CONNECTION',
          loggedInUser: loggedInUser,
          userEmail: userEmail,
          userName: name,
          os: os,
          version: version,
          device: driverId,
        };

        if (selectedClinicId) {
          errProps.clinicId = selectedClinicId;
          errProps.clinicName = clinic.name;
        }

        if (targetDevice.powerOnlyWarning) {
          hidErr = new Error(ErrorMessages.E_USB_CABLE);
          errProps.code = 'E_USB_CABLE';
        }

        if (process.env.NODE_ENV !== 'test') {
          errProps = await actionUtils.sendToRollbar(hidErr, errProps);
        }
        return dispatch(sync.uploadFailure(hidErr, errProps, devices[deviceKey]));
      }
    }

    if (opts && opts.ble) {
      // we need to to scan for Bluetooth devices before the version check,
      // otherwise it doesn't count as a response to a user request anymore
      dispatch(sync.uploadRequest(uploadTargetUser, devices[deviceKey], utc));
      log('Scanning..');
      try {
        await opts.ble.scan();
      } catch (err) {
        const { loggedInUser, allUsers, clinics, selectedClinicId } = getState();
        const userEmail = _.get(allUsers, [loggedInUser, 'username'], 'Unknown');
        const name = _.get(allUsers, [loggedInUser, 'profile','fullName'], 'Unknown');
        const clinic = _.get(clinics, selectedClinicId, {});
        const os = actionUtils.getOSDetails();
        const version = versionInfo.semver;
        log('Error:', err);

        let btErr = new Error(ErrorMessages.E_BLUETOOTH_OFF);
        let errProps = {
          details: err.message,
          utc: actionUtils.getUtc(utc),
          code: 'E_BLUETOOTH_OFF',
          loggedInUser: loggedInUser,
          userEmail: userEmail,
          userName: name,
          os: os,
          version: version,
          device: driverId,
        };

        if (selectedClinicId) {
          errProps.clinicId = selectedClinicId;
          errProps.clinicName = clinic.name;
        }

        if (process.env.NODE_ENV !== 'test') {
          errProps = await actionUtils.sendToRollbar(btErr, errProps);
        }
        return dispatch(sync.uploadFailure(btErr, errProps, devices[deviceKey]));
      }
      log('Done.');
    }

    dispatch(sync.versionCheckRequest());
    const { api } = services;
    const version = versionInfo.semver;
    api.upload.getVersions((err, versions) => {
      if (err) {
        dispatch(sync.versionCheckFailure(err));
        return dispatch(sync.uploadAborted());
      }
      const { uploaderMinimum } = versions;
      // if either the version from the jellyfish response
      // or the local uploader version is somehow an invalid semver
      // we will catch the error and dispatch versionCheckFailure
      try {
        const upToDate = semver.gte(version, uploaderMinimum);
        if (!upToDate) {
          dispatch(sync.versionCheckFailure(null, version, uploaderMinimum));
          return dispatch(sync.uploadAborted());
        }
        else {
          dispatch(sync.versionCheckSuccess());
        }
      }
      catch(err) {
        dispatch(sync.versionCheckFailure(err));
        return dispatch(sync.uploadAborted());
      }

      if (working.uploading.inProgress === true) {
        return dispatch(sync.uploadAborted());
      }

      dispatch(sync.uploadRequest(uploadTargetUser, devices[deviceKey], utc));

      const targetDevice = devices[deviceKey];
      const deviceType = targetDevice.source.type;

      dispatch(doDeviceUpload(targetDevice.source.driverId, opts, utc));
    });
  };
}

export function readFile(userId, deviceKey, file, extension) {
  const { log } = services;

  return async (dispatch, getState) => {
    if (!file) {
      const getFile = async () => {
        dispatch(sync.choosingFile(userId, deviceKey));
        const regex = new RegExp('.+\.ibf', 'g');

        for await (const entry of dirHandle.values()) {
          log(entry);
          // On Eros PDM there should only be one .ibf file
          if (regex.test(entry.name)) {
            file = {
              handle: await entry.getFile(),
              name: entry.name,
            };
          }
        }
      };

      let dirHandle = await get('directory');
      const version = versionInfo.semver;

      if (dirHandle) {
        log(`Retrieved directory handle "${dirHandle.name}" from indexedDB.`);
        if ((await dirHandle.queryPermission()) === 'granted') {
          log('Permission already granted.');
          try {
            await getFile();
          } catch (error) {
            log('Device not ready yet or not plugged in.', error);
            let err = new Error(ErrorMessages.E_NOT_YET_READY);
            let errProps = {
              code: 'E_NOT_YET_READY',
              version: version,
            };
            return dispatch(sync.readFileAborted(err, errProps));
          }
        } else {
          log('Requesting permission..');
          if ((await dirHandle.requestPermission()) === 'granted') {
            try {
              await getFile();
            } catch (err) {
              // device mounted on a different drive number/letter, so we'll have to
              // show directory picker again
              log(err.name, err.message);
              try {
                dirHandle = await window.showDirectoryPicker();
                await set('directory', dirHandle);
                await getFile();
              } catch (error) {
                let err = new Error(`${ErrorMessages.E_READ_FILE}: ${error.message}`);
                let errProps = {
                  code: 'E_READ_FILE',
                  version: version
                };
                return dispatch(sync.readFileAborted(err, errProps));
              }
            }
          } else {
            let err = new Error(ErrorMessages.E_READ_FILE);
            let errProps = {
              code: 'E_READ_FILE',
              version: version
            };
            return dispatch(sync.readFileAborted(err, errProps));
          }
        }
      } else {
        try {
          dirHandle = await window.showDirectoryPicker();
          await set('directory', dirHandle);
          await getFile();
        } catch (error) {
          let err = new Error(`${ErrorMessages.E_READ_FILE}: ${error.message}`);
          let errProps = {
            code: 'E_READ_FILE',
            version: version
          };
          return dispatch(sync.readFileAborted(err, errProps));
        }
      }
    }

    const version = versionInfo.semver;

    if (!file || file.name.slice(-extension.length) !== extension) {
      let err = new Error(ErrorMessages.E_FILE_EXT + extension);
      let errProps = {
        code: 'E_FILE_EXT',
        version: version
      };
      log('Wrong directory selected');
      del('directory');
      return dispatch(sync.readFileAborted(err, errProps));
    }
    else {
      let reader = new FileReader();
      reader.onloadstart = () => {
        dispatch(sync.readFileRequest(userId, deviceKey, file.name));
      };

      const onError = () => {
        let err = new Error(ErrorMessages.E_READ_FILE + file.name);
        let errProps = {
          code: 'E_READ_FILE',
          version: version
        };
        return dispatch(sync.readFileFailure(err, errProps));
      };

      if (file.handle) {
        // we're using File System Access API
        dispatch(sync.readFileRequest(userId, deviceKey, file.name));
        try {
          const filedata = await file.handle.arrayBuffer();

          dispatch(sync.readFileSuccess(userId, deviceKey, filedata));
          const opts = {
            filename : file.name,
            filedata : filedata,
          };
          return dispatch(doUpload(deviceKey, opts));
        } catch (err) {
          log('Error', err);
          return onError();
        }
      } else {
        let reader = new FileReader();
        reader.onloadstart = () => {
          dispatch(sync.readFileRequest(userId, deviceKey, file.name));
        };

        reader.onerror = onError;

        reader.onloadend = ((theFile) => {
          return (e) => {
            dispatch(sync.readFileSuccess(userId, deviceKey, e.srcElement.result));
            dispatch(doUpload(deviceKey));
          };
        })(file);

        reader.readAsArrayBuffer(file);
      }
    }
  };
}

export function doVersionCheck() {
  return (dispatch, getState) => {
    dispatch(sync.versionCheckRequest());
    const { api } = services;
    const version = versionInfo.semver;
    if(env.browser){
      return dispatch(sync.versionCheckSuccess());
    }
    api.upload.getVersions((err, versions) => {
      if (err) {
        return dispatch(sync.versionCheckFailure(err));
      }
      const { uploaderMinimum } = versions;
      // if either the version from the jellyfish response
      // or the local uploader version is somehow an invalid semver
      // we will catch the error and dispatch versionCheckFailure
      try {
        const upToDate = semver.gte(version, uploaderMinimum);
        if (!upToDate) {
          return dispatch(sync.versionCheckFailure(null, version, uploaderMinimum));
        }
        else {
          return dispatch(sync.versionCheckSuccess());
        }
      }
      catch(err) {
        return dispatch(sync.versionCheckFailure(err));
      }
    });
  };
}

export function fetchInfo(cb = _.noop) {
  return (dispatch) => {
    dispatch(sync.fetchInfoRequest());
    const { api } = services;
    api.upload.getInfo((err, info) => {
      if (err) {
        dispatch(sync.fetchInfoFailure(
          createActionError(ErrorMessages.ERR_FETCHING_INFO, err), err
        ));
      } else {
        dispatch(sync.fetchInfoSuccess(info));
      }
      return cb(err, info);
    });
  };
}

export function setTargetTimezone(userId, timezoneName) {
  return (dispatch, getState) => {
    const { allUsers, loggedInUser } = getState();
    const isClinicAccount = personUtils.isClinicianAccount(allUsers[loggedInUser]);
    const { api } = services;
    dispatch(sync.updateProfileRequest());
    let updates = {
      patient: {
        targetTimezone: timezoneName
      }
    };
    api.user.updateProfile(userId, updates, (err, profile) => {
      // suppress unauthorized error until custodial vs normal permissions are ironed out
      // TODO: remove conditional when perms are finalized or accounts are converted
      if (err){
        if (_.get(err,'status') !== 401) {
          dispatch(sync.updateProfileFailure(err));
        } else {
          let newProfile = actionUtils.mergeProfileUpdates(_.get(allUsers[userId], 'profile', {}), updates);
          dispatch(sync.updateProfileSuccess(newProfile, userId));
        }
      } else {
        dispatch(sync.updateProfileSuccess(profile, userId));
      }
      if (isClinicAccount) {
        return dispatch(
          sync.setTargetTimezone(userId, timezoneName, {
            metric: { eventName: metrics.CLINIC_TIMEZONE_SELECT },
          })
        );
      }
      return dispatch(sync.setTargetTimezone(userId, timezoneName));
    });
  };
}

export function clickDeviceSelectionDone() {
  return (dispatch, getState) => {
    const {
      targetDevices,
      uploadTargetUser,
      allUsers,
      loggedInUser,
      selectedClinicId,
      clinics,
    } = getState();
    const isClinicAccount = personUtils.isClinicianAccount(allUsers[loggedInUser]);
    const { api } = services;
    const userTargetDevices = targetDevices[uploadTargetUser];
    if (selectedClinicId) {
      dispatch(sync.updateClinicPatientRequest());
      const patient = _.get(clinics,[selectedClinicId,'patients',uploadTargetUser]);
      if (!_.isEmpty(userTargetDevices)) {
        let updatedPatient = _.extend(patient, {targetDevices:userTargetDevices});
        api.clinics.updateClinicPatient(
          selectedClinicId,
          uploadTargetUser,
          updatedPatient,
          (err, patient) => {
            if(err){
              dispatch(sync.updateClinicPatientFailure(err));
            } else{
              dispatch(
                sync.updateClinicPatientSuccess(
                  selectedClinicId,
                  uploadTargetUser,
                  patient
                )
              );
              _.forEach(targetDevices[uploadTargetUser], function(device) {
                dispatch(sync.clinicAddDevice(device));
              });
              return dispatch(
                setPage(pages.MAIN, undefined, {
                  metric: { eventName: metrics.CLINIC_DEVICES_DONE },
                })
              );
            }
          }
        );
      }
    } else {
      dispatch(sync.updateProfileRequest());
      if (!_.isEmpty(userTargetDevices)) {
        let updates = {
          patient: {
            targetDevices: userTargetDevices
          }
        };
        api.user.updateProfile(uploadTargetUser, updates, (err, profile) => {
          // suppress unauthorized error until custodial vs normal permissions are ironed out
          // TODO: remove conditional when perms are finalized or accounts are converted
          if (err) {
            if (_.get(err,'status') !== 401) {
              dispatch(sync.updateProfileFailure(err));
            } else {
              let newProfile = actionUtils.mergeProfileUpdates(_.get(allUsers[uploadTargetUser], 'profile', {}), updates);
              dispatch(sync.updateProfileSuccess(newProfile, uploadTargetUser));
              if (isClinicAccount) {
                _.forEach(userTargetDevices, function(device){
                  dispatch(sync.clinicAddDevice(device));
                });
              }
            }
          } else {
            dispatch(sync.updateProfileSuccess(profile, uploadTargetUser));
            if (isClinicAccount) {
              _.forEach(userTargetDevices, function(device){
                dispatch(sync.clinicAddDevice(device));
              });
            }
          }
          if (isClinicAccount) {
            return dispatch(
              setPage(pages.MAIN, undefined, {
                metric: { eventName: metrics.CLINIC_DEVICES_DONE },
              })
            );
          }
          return dispatch(setPage(pages.MAIN));
        });
      }
    }
  };
}

export function clickEditUserNext(profile) {
  return (dispatch, getState) => {
    const { uploadTargetUser, allUsers } = getState();
    const { api } = services;
    const previousProfile = _.get(allUsers[uploadTargetUser], 'profile', {});
    const updates = profile;
    if (!_.isEmpty(profile)){
      dispatch(sync.updateProfileRequest());
      api.user.updateProfile(uploadTargetUser, profile, (err, profile) => {
        // suppress unauthorized error until custodial vs normal permissions are ironed out
        // TODO: remove conditional when perms are finalized or accounts are converted
        if (err) {
          if(_.get(err,'status') !== 401) {
            return dispatch(sync.updateProfileFailure(err));
          } else {
            const { allUsers } = getState();
            let newProfile = actionUtils.mergeProfileUpdates(_.get(allUsers[uploadTargetUser], 'profile', {}), updates);
            dispatch(sync.updateProfileSuccess(newProfile, uploadTargetUser));
            if (_.get(newProfile, 'patient.mrn', false) && !_.get(previousProfile, 'patient.mrn', false)) {
              dispatch(sync.clinicAddMrn());
            }
            if (_.get(newProfile, 'patient.email', false) && !_.get(previousProfile, 'patient.email', false)) {
              dispatch(sync.clinicAddEmail());
            }
          }
        } else {
          dispatch(sync.updateProfileSuccess(profile, uploadTargetUser));
          if (_.get(profile, 'patient.mrn', false) && !_.get(previousProfile, 'patient.mrn', false)) {
            dispatch(sync.clinicAddMrn());
          }
          if (_.get(profile, 'patient.email', false) && !_.get(previousProfile, 'patient.email', false)) {
            dispatch(sync.clinicAddEmail());
          }
        }
        const { targetDevices, devices} = getState();
        const targetedDevices = _.get(targetDevices, uploadTargetUser, []);
        const supportedDeviceKeys = _.keys(devices);
        const atLeastOneDeviceSupportedOnSystem = _.some(targetedDevices, (key) => {
          return _.includes(supportedDeviceKeys, key);
        });
        if (_.isEmpty(targetedDevices) || !atLeastOneDeviceSupportedOnSystem) {
          return dispatch(setPage(pages.SETTINGS));
        } else {
          return dispatch(setPage(pages.MAIN));
        }
      });
    }
  };
}

export function clickClinicEditUserNext(selectedClinicId, patientId, patient) {
  return (dispatch, getState) => {
    const { api } = services;
    const { clinics } = getState();
    const previousPatient = _.get(clinics, [selectedClinicId, 'patients', patientId]);
    if (!_.isEmpty(patient)){
      dispatch(sync.updateClinicPatientRequest());
      api.clinics.updateClinicPatient(selectedClinicId, patientId, patient, (err, patient) => {
        if (err) {
          return dispatch(sync.updateClinicPatientFailure(err));
        } else {
          dispatch(sync.updateClinicPatientSuccess(selectedClinicId, patientId, patient));
          if (_.get(patient, 'mrn', false) && !_.get(previousPatient, 'mrn', false)) {
            dispatch(sync.clinicAddMrn());
          }
          if (_.get(patient, 'email', false) && !_.get(previousPatient, 'email', false)) {
            dispatch(sync.clinicAddEmail());
          }
        }
        const { targetDevices, devices } = getState();
        const targetedDevices = _.get(targetDevices, patientId, []);
        const supportedDeviceKeys = _.keys(devices);
        const atLeastOneDeviceSupportedOnSystem = _.some(targetedDevices, (key) => {
          return _.includes(supportedDeviceKeys, key);
        });
        if (_.isEmpty(targetedDevices) || !atLeastOneDeviceSupportedOnSystem) {
          return dispatch(setPage(pages.SETTINGS));
        } else {
          return dispatch(setPage(pages.MAIN));
        }
      });
    }
  };
}

export function retrieveTargetsFromStorage() {
  return (dispatch, getState) => {
    const { devices, uploadTargetUser } = getState();
    const { api } = services;
    let fromLocalStore = false;

    dispatch(sync.retrieveUsersTargetsFromStorage());
    let targets = localStore.getItem('devices');
    if (targets !== null) {
      fromLocalStore = true;
      // wipe out the deprecated 'devices' localStore key
      localStore.removeItem('devices');
      const uploadsByUser = actionUtils.getDeviceTargetsByUser(targets);
      dispatch(sync.setUploads(uploadsByUser));
      dispatch(sync.setUsersTargets(targets));
    }

    const { targetDevices, targetTimezones, allUsers, loggedInUser } = getState();
    const isClinicAccount = personUtils.isClinicianAccount(allUsers[loggedInUser]);

    if (isClinicAccount) {
      return dispatch(
        setPage(
          pages.CLINIC_USER_SELECT,
          null /*{metric: {eventName: metrics.CLINIC_SEARCH_DISPLAYED}}*/
        )
      );
    }
    // redirect based on having a supported device if not clinic account
    if (!_.isEmpty(_.get(targetDevices, uploadTargetUser))) {
      let usersWithTargets = {};
      _.forOwn(targetDevices, (devicesArray, userId) => {
        usersWithTargets[userId] = _.map(devicesArray, (deviceKey) => {
          return {key: deviceKey};
        });
      });
      _.forOwn(targetTimezones, (timezoneName, userId) => {
        usersWithTargets[userId] = _.map(usersWithTargets[userId], (target) => {
          if (timezoneName != null) {
            target.timezone = timezoneName;
          }
          return target;
        });
      });
      const targetDeviceKeys = targetDevices[uploadTargetUser];
      const supportedDeviceKeys = _.keys(devices);
      const atLeastOneDeviceSupportedOnSystem = _.some(targetDeviceKeys, (key) => {
        return _.includes(supportedDeviceKeys, key);
      });

      if(!fromLocalStore){
        const uploadsByUser = actionUtils.getDeviceTargetsByUser(usersWithTargets);
        dispatch(sync.setUploads(uploadsByUser));
      } else {
        if (
          !_.isEmpty(targetDevices[uploadTargetUser]) &&
          !_.isEmpty(targetTimezones[uploadTargetUser])
        ) {
          dispatch(sync.updateProfileRequest());
          const updates = {
            patient: {
              targetDevices: targetDevices[uploadTargetUser],
              targetTimezone: targetTimezones[uploadTargetUser],
            },
          };
          api.user.updateProfile(uploadTargetUser, updates, (err, profile) => {
            // suppress unauthorized error until custodial vs normal permissions are ironed out
            // TODO: remove conditional when perms are finalized or accounts are converted
            if (err) {
              if (_.get(err, 'status') !== 401) {
                dispatch(sync.updateProfileFailure(err));
              } else {
                let newProfile = actionUtils.mergeProfileUpdates(
                  _.get(allUsers[uploadTargetUser], 'profile', {}),
                  updates
                );
                dispatch(
                  sync.updateProfileSuccess(newProfile, uploadTargetUser)
                );
              }
            } else {
              dispatch(sync.updateProfileSuccess(profile, uploadTargetUser));
            }
          });
        }
      }

      if (atLeastOneDeviceSupportedOnSystem) {
        return dispatch(setPage(pages.MAIN));
      } else {
        return dispatch(setPage(pages.SETTINGS));
      }
    } else {
      return dispatch(setPage(pages.SETTINGS));
    }
  };
}

export function goToPrivateWorkspace() {
  return (dispatch, getState) => {
    const { api } = services;
    const { loggedInUser, allUsers, selectedClinicId } = getState();
    const isClinicianAccount = personUtils.isClinicianAccount(allUsers[loggedInUser]);
    const metricProps = selectedClinicId ? { clinicId: selectedClinicId } : {};
    api.metrics.track(metrics.WORKSPACE_SWITCH_PRIVATE, metricProps);
    dispatch(selectClinic(api, null));
    if (isClinicianAccount) {
      return dispatch(
        setPage(
          pages.CLINIC_USER_SELECT,
          actionSources[actionTypes.SET_PAGE]
        )
      );
    } else {
      return dispatch(
        setPage(pages.MAIN, actionSources[actionTypes.SET_PAGE])
      );
    }
  };
}

export function createCustodialAccount(profile) {
  return (dispatch, getState) => {
    const { api } = services;
    dispatch(sync.createCustodialAccountRequest());
    api.user.createCustodialAccount(profile, (err, account) => {
      if (err) {
        dispatch(sync.createCustodialAccountFailure(err));
      }
      else {
        dispatch(sync.createCustodialAccountSuccess(account));
        if (_.get(account, 'profile.patient.mrn', false)) {
          dispatch(sync.clinicAddMrn());
        }
        if (_.get(account, 'profile.patient.email', false)) {
          dispatch(sync.clinicAddEmail());
        }
        dispatch(sync.setUploadTargetUser(account.userid));
        dispatch(setPage(pages.SETTINGS));
      }
    });
  };
}

/*
 * COMPLEX ACTION CREATORS
 */

export function setUploadTargetUserAndMaybeRedirect(targetId) {
  return (dispatch, getState) => {
    const { devices, targetDevices } = getState();
    dispatch(sync.setUploadTargetUser(targetId));
    const { api } = services;
    dispatch(sync.setBlipViewDataUrl(
      api.makeBlipUrl(actionUtils.viewDataPathForUser(targetId))
    ));
    const targetedDevices = _.get(targetDevices, targetId, []);
    const supportedDeviceKeys = _.keys(devices);
    const atLeastOneDeviceSupportedOnSystem = _.some(targetedDevices, (key) => {
      return _.includes(supportedDeviceKeys, key);
    });
    if (_.isEmpty(targetedDevices) || !atLeastOneDeviceSupportedOnSystem) {
      return dispatch(setPage(pages.SETTINGS));
    }
  };
}

export function checkUploadTargetUserAndMaybeRedirect() {
  return (dispatch, getState) => {
    const { api } = services;
    const { devices, targetDevices, uploadTargetUser, clinics, selectedClinicId } = getState();
    if (!uploadTargetUser) {
      return;
    }
    let targetedDevices = _.get(targetDevices, uploadTargetUser, []);
    if(selectedClinicId){
      dispatch(fetchPatient(api, uploadTargetUser));
      targetedDevices = _.get(clinics, [selectedClinicId, 'patients', uploadTargetUser, 'targetDevices'], []);
    }
    const supportedDeviceKeys = _.keys(devices);
    const atLeastOneDeviceSupportedOnSystem = _.some(targetedDevices, (key) => {
      return _.includes(supportedDeviceKeys, key);
    });
    if (_.isEmpty(targetedDevices) || !atLeastOneDeviceSupportedOnSystem) {
      return dispatch(
        setPage(pages.SETTINGS, undefined, {
          metric: { eventName: metrics.CLINIC_NEXT },
        })
      );
    } else {
      return dispatch(
        setPage(pages.MAIN, undefined, {
          metric: { eventName: metrics.CLINIC_NEXT },
        })
      );
    }
  };
}

export function clickAddNewUser(){
  return (dispatch, getState) =>{
    // check state for clinic patient limit exceeded and if so, display the limit modal
    const { selectedClinicId, clinics } = getState();
    const clinic = _.get(clinics, selectedClinicId);
    if (clinic?.ui?.warnings.limitReached) {
      return dispatch(sync.displayPatientLimitModal());
    }
    dispatch(sync.setUploadTargetUser(null));
    dispatch(setPage(pages.CLINIC_USER_EDIT, undefined, {metric: {eventName: metrics.CLINIC_ADD}}));
  };
}

export function setPage(page, actionSource = actionSources[actionTypes.SET_PAGE], metric) {
  return (dispatch, getState) => {
    if (pagesMap[page]) {
      const pageProps = { pathname: pagesMap[page] };

      const meta = { source: actionSource };
      _.assign(meta, metric);
      pageProps.state = { meta };

      const { hash } = window.location;
      if (hash) {
        pageProps.hash = hash;
      }
      dispatch(push(pageProps));
    }
  };
}

/**
 * Fetch Patient Action Creator
 *
 * @param  {Object} api an instance of the API wrapper
 * @param {String|Number} id
 */
 export function fetchPatient(api, id, cb = _.noop) {
  return (dispatch, getState) => {
    // If we have a valid cache of the patient in our redux store, return without dispatching the fetch
    if(checkCacheValid(getState, 'allUsers', cacheByIdOptions(id))) {
      const patient = _.get(getState(), ['allUsers', id]);
      // In cases where the patient was set via the results from getPatients, the settings will not
      // be present, and we need them for the data views, so we bypass the cache to ensure we get
      // the complete patient object
      if (_.get(patient, 'settings')) {
        dispatch(sync.fetchPatientSuccess(patient));

        // Invoke callback if provided
        cb(null, patient);
        return null;
      }
    }

    dispatch(sync.fetchPatientRequest());

    api.patient.get(id, (err, patient) => {
      if (err) {
        let errMsg = ErrorMessages.ERR_FETCHING_PATIENT;
        let link = null;
        let status = _.get(err, 'status', null);
        if (status === 404) {
          errMsg = ErrorMessages.ERR_YOUR_ACCOUNT_NOT_CONFIGURED;
        }
        dispatch(sync.fetchPatientFailure(
          createActionError(errMsg, err), err, link
        ));
      } else {
        dispatch(sync.fetchPatientSuccess(patient));
      }

      // Invoke callback if provided
      cb(err, patient);
    });
  };
}

/**
 * Fetch Associated Accounts Action Creator
 *
 * @param  {Object} api an instance of the API wrapper
 */
 export function fetchAssociatedAccounts(api) {
  return (dispatch) => {
    dispatch(sync.fetchAssociatedAccountsRequest());

    api.user.getAssociatedAccounts((err, accounts) => {
      if (err) {
        dispatch(sync.fetchAssociatedAccountsFailure(
          createActionError(ErrorMessages.ERR_FETCHING_ASSOCIATED_ACCOUNTS, err), err
        ));
      } else {
        dispatch(sync.fetchAssociatedAccountsSuccess(accounts));
      }
    });
  };
}

/**
 * Fetch Patients for Clinic Action Creator
 *
 * @param {String} clinicId - Id of the clinic
 * @param {Object} [options] - search options
 * @param {String} [options.search] - search query string
 * @param {Number} [options.offset] - search page offset
 * @param {Number} [options.limit] - results per page
 * @param {Number} [options.sort] - directionally prefixed field to sort by (e.g. +name or -name)
 */
 export function fetchPatientsForClinic(clinicId, options = {}) {
  const { api } = services;
  return (dispatch) => {
    dispatch(sync.fetchPatientsForClinicRequest());

    api.clinics.getPatientsForClinic(clinicId, options, (err, results) => {
      if (err) {
        dispatch(sync.fetchPatientsForClinicFailure(
          createActionError(ErrorMessages.ERR_FETCHING_PATIENTS_FOR_CLINIC, err), err
        ));
      } else {
        const { data, meta } = results;
        dispatch(sync.fetchPatientsForClinicSuccess(clinicId, data, meta.count));
      }
    });
  };
}

/**
 * Create custodial Patient for Clinic Action Creator
 *
 * @param {String} clinicId - Id of the clinic
 * @param {Object} patient
 * @param {String} patient.email - The email address of the patient
 * @param {String} patient.fullName - The full name of the patient
 * @param {String} patient.birthDate - YYYY-MM-DD
 * @param {String} [patient.mrn] - The medical record number of the patient
 * @param {String[]} [patient.targetDevices] - Array of string target devices
 */
 export function createClinicCustodialAccount(clinicId, patient) {
  const { api } = services;
  return (dispatch) => {
    dispatch(sync.createClinicCustodialAccountRequest());
    api.clinics.createClinicCustodialAccount(clinicId, patient, (err, result) => {
      if (err) {
        dispatch(sync.createClinicCustodialAccountFailure(
          createActionError(ErrorMessages.ERR_CREATING_CUSTODIAL_ACCOUNT, err), err
        ));
      } else {
        dispatch(sync.createClinicCustodialAccountSuccess(clinicId, result, result.id));
        if (_.get(patient, 'mrn', false)) {
          dispatch(sync.clinicAddMrn());
        }
        if (_.get(patient, 'email', false)) {
          dispatch(sync.clinicAddEmail());
        }
        dispatch(sync.setUploadTargetUser(result.id));
        dispatch(setPage(pages.SETTINGS));
      }
    });
  };
}

/**
 * Get Clinics for Clinician Action Creator
 *
 * @param {Object} api - an instance of the API wrapper
 * @param {String} clinicianId - Clinician User ID
 * @param {Object} [options]
 * @param {Number} [options.limit] - Query result limit
 * @param {Number} [options.offset] - Query offset
 * @param {Function} [cb] - optional callback
 */
 export function getClinicsForClinician(api, clinicianId, options = {}, cb = _.noop) {
  return (dispatch) => {
    dispatch(sync.getClinicsForClinicianRequest());

    api.clinics.getClinicsForClinician(clinicianId, options, (err, clinics) => {
      if (err) {
        dispatch(sync.getClinicsForClinicianFailure(
          createActionError(ErrorMessages.ERR_FETCHING_CLINICS_FOR_CLINICIAN, err), err
        ));
      } else {
        dispatch(sync.getClinicsForClinicianSuccess(clinics, clinicianId, options));
      }
      // fetch EHR and MRN settings for clinics
      _.each(clinics, (clinic) => {
        console.log('fetching settings for clinic', clinic.clinic.id);
        dispatch(fetchClinicEHRSettings(api, clinic.clinic.id));
        dispatch(fetchClinicMRNSettings(api, clinic.clinic.id));
      });
      cb(err, clinics);
    });
  };
}

/**
 * Fetch Clinic MRN Settings Action Creator
 *
 * @param {Object} api - an instance of the API wrapper
 * @param {String} clinicId - Id of the clinic
 */
export function fetchClinicMRNSettings(api, clinicId) {
  return (dispatch) => {
    dispatch(sync.fetchClinicMRNSettingsRequest());

    api.clinics.getMRNSettings(clinicId, (err, settings) => {
      if (err) {
        dispatch(sync.fetchClinicMRNSettingsFailure(
          createActionError(ErrorMessages.ERR_FETCHING_CLINIC_MRN_SETTINGS, err), err
        ));
      } else {
        dispatch(sync.fetchClinicMRNSettingsSuccess(clinicId, settings));
      }
    });
  };
}

/**
 * Fetch Clinic EHR Settings Action Creator
 *
 * @param {Object} api - an instance of the API wrapper
 * @param {String} clinicId - Id of the clinic
 */
export function fetchClinicEHRSettings(api, clinicId) {
  return (dispatch) => {
    dispatch(sync.fetchClinicEHRSettingsRequest());

    api.clinics.getEHRSettings(clinicId, (err, settings) => {
      if (err) {
        dispatch(sync.fetchClinicEHRSettingsFailure(
          createActionError(ErrorMessages.ERR_FETCHING_CLINIC_EHR_SETTINGS, err), err
        ));
      } else {
        dispatch(sync.fetchClinicEHRSettingsSuccess(clinicId, settings));
      }
    });
  };
}


/**
 * Select Clinic Action Creator
 *
 * Immediately sets or unsets the selected clinic to state,
 * then fetches additional clinic metadata asynchronously.
 *
 * @param {Object} api - an instance of the API wrapper
 * @param {String | null} clinicId - Id of the clinic, or null do unset
 */
export function selectClinic(api, clinicId) {
  return (dispatch, getState) => {
    dispatch(sync.selectClinicSuccess(clinicId));

    const { clinics = {} } = getState();
    const clinic = clinics[clinicId];

    if (clinic) {
      const fetchers = {};

      if (_.isNil(clinics[clinicId].patientCount)) {
        fetchers.clinicPatientCount = api.clinics.getClinicPatientCount.bind(api, clinicId);
        dispatch(sync.fetchClinicPatientCountRequest());
      }

      if (_.isNil(clinics[clinicId].patientCountSettings)) {
        fetchers.clinicPatientCountSettings = api.clinics.getClinicPatientCountSettings.bind(api, clinicId);
        dispatch(sync.fetchClinicPatientCountSettingsRequest());
      }

      async.parallel(async.reflectAll(fetchers), (err, results) => {
        const selectedClinic = { ...clinic };
        const errors = _.mapValues(results, ({error}) => error);
        const values = _.mapValues(results, ({value}) => value);

        if (errors?.clinicPatientCount) {
          dispatch(sync.fetchClinicPatientCountFailure(
            createActionError(ErrorMessages.ERR_FETCHING_CLINIC_PATIENT_COUNT, errors.clinicPatientCount), errors.clinicPatientCount
          ));
        }

        if (errors?.clinicPatientCountSettings) {
          dispatch(sync.fetchClinicPatientCountSettingsFailure(
            createActionError(ErrorMessages.ERR_FETCHING_CLINIC_PATIENT_COUNT_SETTINGS, errors.clinicPatientCountSettings), errors.clinicPatientCountSettings
          ));
        }

        if (values.clinicPatientCount) {
          dispatch(sync.fetchClinicPatientCountSuccess(clinicId, values.clinicPatientCount));
          selectedClinic.patientCount = values.clinicPatientCount?.patientCount;
        }

        if (values.clinicPatientCountSettings) {
          dispatch(sync.fetchClinicPatientCountSettingsSuccess(clinicId, values.clinicPatientCountSettings));
          selectedClinic.patientCountSettings = values.clinicPatientCountSettings;
        }

        if (_.isFinite(selectedClinic.patientCount) && _.isPlainObject(selectedClinic.patientCountSettings)) {
          dispatch(sync.setClinicUIDetails(clinicId, clinicUIDetails(selectedClinic)));
        }
      });
    }
  };
}
