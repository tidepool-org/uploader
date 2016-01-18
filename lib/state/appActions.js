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
 /* global chrome */

var _ = require('lodash');
var async = require('async');
var stacktrace = require('stack-trace');

var sundial = require('sundial');
var localStore = require('../core/localStore');
var api = require('../core/api');
var device = require('../core/device');
var carelink = require('../core/carelink');
var appState = require('./appState');

var config = require('../config.js');

var appActions = {};

appActions.trackedState = {
  LOGIN_SUCCESS : 'Login Successful',
  LOGOUT_CLICKED : 'Clicked Log Out',
  UPLOAD_FAILED : 'Upload Failed',
  UPLOAD_SUCCESS : 'Upload Successful',
  UPLOAD_STARTED : 'Upload Attempted',
  CARELINK_FETCH_FAILED : 'CareLink Fetch Failed',
  CARELINK_FETCH_SUCCESS : 'CareLink Fetch Successful',
  CARELINK_LOAD_FAILED : 'CareLink Upload Failed',
  CARELINK_LOAD_SUCCESS : 'CareLink Upload Successful',
  SEE_IN_BLIP : 'Clicked See Data in Blip'
};

appActions.errorText = {
  E_READING_FILE : 'Error reading file: ',
  E_WRONG_FILE_EXT : 'Please choose a file ending in ',
  E_UPLOAD_IN_PROGRESS : 'Cannot start upload while an upload is in progress',
  E_UNSUPPORTED_TYPE : 'Unsupported upload source type: ',
  E_INVALID_UPLOAD_INDEX : 'Invalid upload index: ',
  E_DEVICE_NOT_CONNECTED : 'The device doesn\'t appear to be connected'
};

appActions.errorStages = {
  STAGE_SETUP : { code: 'E_SETUP' , friendlyMessage: 'Error during setup' },
  STAGE_LOGIN : { code: 'E_LOGIN' , friendlyMessage: 'Error during login' },
  STAGE_AFTER_LOGIN : { code: 'E_AFTER_LOGIN' , friendlyMessage: 'You have no upload access - please set up data storage in blip or ask for permission to upload to another person\'s account.' },
  STAGE_LOGOUT : { code: 'E_LOGOUT' , friendlyMessage: 'Error during logout' },
  STAGE_DETECT_DEVICES : { code: 'E_DETECTING_DEVICES' , friendlyMessage: 'Error detecting devices' },
  STAGE_PICK_FILE : { code: 'E_SELECTING_FILE' , friendlyMessage: 'Error during file selection' },
  STAGE_READ_FILE : { code: 'E_READING_FILE' , friendlyMessage: 'Error trying to read file' },
  STAGE_UPLOAD : { code: 'E_UPLOADING' , friendlyMessage: 'Error uploading data' },
  STAGE_METADATA_UPLOAD : { code: 'E_METADATA_UPLOAD' , friendlyMessage: 'Error uploading upload metadata'},
  STAGE_DEVICE_UPLOAD : { code: 'E_DEVICE_UPLOAD' , friendlyMessage: 'Error uploading device data' },
  STAGE_DEVICE_DETECT : { code: 'E_DEVICE_DETECT' , friendlyMessage: 'Hmm, we couldn\'t detect your device' },
  STAGE_DRIVER : { code: 'E_DRIVER' , friendlyMessage: 'You may need to install the ', driverName: 'device driver' },
  STAGE_CARELINK_UPLOAD : { code: 'E_CARELINK_UPLOAD' , friendlyMessage: 'Error uploading CareLink data' },
  STAGE_CARELINK_FETCH : { code: 'E_CARELINK_FETCH' , friendlyMessage: 'Error fetching CareLink data' }
};

function extractMessage(err) {
  // if there's no message, return `error` or 'Unknown error message'
  if (_.isEmpty(err.message)) {
    return err.error || 'Unknown error message';
  }
  return err.message;
}

function getErrorName(err) {
  if (err.name) {
    return err.name;
  }
  return 'POST error';
}

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

appActions.addMoreInfoToError = function(err, stage) {
  var name = err.name;
  err.version = config.namedVersion;
  // the current hack for CareLink incorrect creds throws an error with the code
  // and friendlyMessage already set, so we don't want to steamroll it
  err.code = err.code || stage.code;
  err.friendlyMessage = err.friendlyMessage || stage.friendlyMessage;
  err.driverLink = stage.driverLink;
  err.driverName = stage.driverName;
  err.stringifiedStack = _.pluck(_.filter(stacktrace.parse(err), function(cs) { return cs.functionName !== null; }), 'functionName').join(', ');
  err.debug = 'Detail: ' + extractMessage(err) + ' | ' +  'Error UTC Time: ' +
    sundial.utcDateString() + ' | ' + 'Code: ' + err.code + ' | ' + 'Error Type: ' +
    getErrorName(err) + ' | ' + 'Version: ' + err.version;
  if (err.step != null) {
    err.debug = err.debug + ' | ' + 'Driver Step: ' + err.step;
  }
  if (err.stringifiedStack) {
    err.debug = err.debug + ' | ' + 'Stack Trace: ' + err.stringifiedStack;
  }
};

appActions.bindApp = function(app) {
  this.app = app;
  return this;
};

appActions.changeGroup = function(userid) {
  // reset upload state when changing group
  for(var i in this.app.state.uploads) {
    appActions.reset(i);
  }

  // we are storing the timezone on a per device basis
  var devicesById = localStore.getItem('devices') || {};
  var targetDevices = devicesById[userid] || [];
  var targetTimezone = getTargetTimezone(targetDevices);

  if (_.isEmpty(targetDevices) || _.isEmpty(targetTimezone)) {
    this.app.setState({
      targetId: userid,
      targetDevices: targetDevices,
      targetTimezone: targetTimezone,
      page: 'settings'
    });
  }
  this.app.setState({
    targetId: userid,
    targetDevices: _.pluck(targetDevices, 'key'),
    targetTimezone: targetTimezone
  });
};

appActions.changeTimezone = function(timezone) {
  this.app.setState({
    targetTimezone: timezone
  });
};

appActions.load = function(cb) {
  var self = this;
  var loadLocalStore = function(cb) {
    localStore.init(localStore.getInitialState(), function() {
      cb();
    });
  };

  var getOS = function(cb) {
    if (typeof chrome !== 'undefined') { // test environment is not chrome
      chrome.runtime.getPlatformInfo(function (platformInfo) {
        self.app.setState({_os: platformInfo.os}, function() {
          self._hideUnavailableDevices();
        });
        cb();
      });
    }else{
      cb();
    }
  };

  function setHostsWithCallback(cb) {
    api.setHosts(_.pick(config, ['API_URL', 'UPLOAD_URL', 'BLIP_URL']));
    return cb(null);
  }

  async.series([
    loadLocalStore,
    getOS,
    device.init.bind(device, {
      api: api,
      version: config.namedVersion
    }),
    carelink.init.bind(carelink, {
      api: api
    }),
    api.init.bind(api, {
      // these are for initialization only -- they get overwritten
      // if someone changes the URL
      apiUrl: config.API_URL,
      uploadUrl: config.UPLOAD_URL
    }),
    setHostsWithCallback,
  ], function(err, results) {
    if (err) {
      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_SETUP']);
      return cb(err);
    }

    var session = results[4];
    if (!session) {
      self.app.setState({
        page: 'login'
      });
      return cb();
    }

    async.series([
      api.user.account.bind(null),
      api.user.profile.bind(null),
      api.user.getUploadGroups.bind(null)
    ], function(err, results) {
      var account = results[0];
      var profile = results[1];
      var uploadGroups = results[2];

      var user = _.assign({}, account, {profile: profile, uploadGroups: uploadGroups});

      // once we've logged in, we don't want the right-click menus around, so
      // delete them.
      // because our test env isn't chrome, we have to test for it
      if (typeof chrome !== 'undefined') {
        chrome.contextMenus.removeAll();
      }

      appActions._afterLoginPage(user, cb);
    });
  });
};

appActions.login = function(credentials, options, cb) {
  var self = this;
  async.series([
    api.user.login.bind(null, credentials, options),
    api.user.profile,
    api.user.getUploadGroups.bind(null)
  ], function(err, results) {
    if (err) {
      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_LOGIN']);
      return cb(err);
    }
    self._logMetric(self.trackedState.LOGIN_SUCCESS);
    // once we've logged in, we don't want the right-click menus around, so
    // delete them.
    // because our test env isn't chrome, we have to test for it
    if (typeof chrome !== 'undefined') {
      chrome.contextMenus.removeAll();
    }

    var account = results[0] && results[0].user;
    var profile = results[1];
    var uploadGroups = results[2];

    var user = _.assign({}, account, {profile: profile, uploadGroups: uploadGroups});

    appActions._afterLoginPage(user, cb);
  });
};

// make sure we have the correct default targetId
appActions._getDefaultTargetId = function(loggedInUser){
  // default to the logged in user's id
  var userid = loggedInUser.userid;

  var possibilities = _.filter(loggedInUser.uploadGroups, function(group) {
    // if the account isn't marked with patient details we don't upload to it
    return _.isEmpty(group.profile.patient) === false;
  });

  // is there only one possible default?
  if (possibilities.length === 1) {
    return possibilities[0].userid;
  }
  else if (possibilities.length === 0) {
    // TODO: this should surface as a new app 'page' with an error message
    // stating that the logged in user doesn't have data storage set up for his/herself
    // nor upload permission to any other accounts
    // then there should be a prompting to go to blip and set up data storage
    var err = new Error('No data storage for logged in user and no permissions to upload for others!');
    this.addMoreInfoToError(err, this.errorStages['STAGE_AFTER_LOGIN']);
    console.warn(err.debug);
  }
  else if (possibilities.length > 1) {
    if (_.isEmpty(loggedInUser.profile.patient)) {
      return null;
    }
  }
  return userid;
};

appActions._afterLoginPage = function(user, cb) {
  var self = this;

  var defaultTargetId = self._getDefaultTargetId(user);
  var devices = localStore.getItem('devices') || {};
  var targetDevicesWithTimezones = devices[defaultTargetId];
  var targetDevices = _.pluck(targetDevicesWithTimezones, 'key');
  var targetTimezone = getTargetTimezone(targetDevicesWithTimezones);

  if (!_.isEmpty(targetDevices) && !_.isEmpty(targetTimezone)) {
    self.app.setState({
      user: user,
      targetId: defaultTargetId,
      targetDevices: targetDevices,
      targetTimezone: targetTimezone,
      page: 'main'
    });

    return cb(null, user);
  }

  self.app.setState({
    user: user,
    targetId: defaultTargetId,
    targetDevices: [],
    targetTimezone: null,
    page: 'settings'
  });

  return cb(null, user);
};

appActions.logout = function(cb) {
  var self = this;
  self._logMetric(this.trackedState.LOGOUT_CLICKED);
  api.user.logout(function(err) {
    if (err) {
      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_LOGOUT']);
      return cb(err);
    }

    self.app.setState(_.assign(appState.getInitial(), {
      page: 'login'
    }));

    return cb();
  });
};

appActions.viewData = function() {
  this._logMetric(this.trackedState.SEE_IN_BLIP);
  return;
};

appActions.detectDevices = function(cb) {
  var self = this;
  device.detectAll(function(err, devices) {
    if (err) {
      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_DETECT_DEVICES']);
      return cb(err);
    }

    var uploads = self._mergeDevicesWithUploads(
      devices, self.app.state.uploads
    );
    self.app.setState({
      uploads: uploads
    });

    return cb(null, devices);
  });
};

appActions._hideUnavailableDevices = function() {
  var uploads = _.cloneDeep(this.app.state.uploads);
  // this.app._os can be "mac", "win", "android", "cros", "linux", or "openbsd"
  if (this.app.state._os === 'mac') {
    uploads = _.reject(uploads, function(d) {
      return d.key === 'precisionxtra' ||
      d.key === 'abbottfreestylelite' ||
      d.key === 'abbottfreestylefreedomlite';
    });
  }
  else if (this.app.state._os === 'win') {
    uploads = _.reject(uploads, function(d) {
      return;
    });
  }
  this.app.setState({uploads: uploads});
};

appActions.chooseDevices = function() {
  this.app.setState({
    page: 'settings',
    dropMenu: false
  });
};

appActions.addOrRemoveTargetDevice = function(e) {
  var targetDevices = this.app.state.targetDevices;
  if (e.target.checked) {
    targetDevices.push(e.target.value);
  }
  else {
    targetDevices = _.reject(targetDevices, function(device) {
      return device === e.target.value;
    });
  }

  this.app.setState({
    targetDevices: targetDevices
  });
};

appActions.storeUserTargets = function(targetId) {
  // timezone
  var targetTimezone = this.app.state.targetTimezone;
  // devices
  var devicesById = localStore.getItem('devices') || {};
  var targetDevices = this.app.state.targetDevices;
  var devicesWithTimezoneToStore = _.map(targetDevices, function(deviceKey) {
    return {
      key: deviceKey,
      timezone: targetTimezone
    };
  });
  devicesById[targetId] = devicesWithTimezoneToStore;
  localStore.setItem('devices', devicesById);

  // the Done button *should* be disabled preventing this function from
  // even firing when no timezone is selected
  // so this is just an extra defensive check (which also has a unit test, natch)
  if (!_.isEmpty(targetTimezone)) {
    this.app.setState({
      page: 'main'
    });
  }
};

appActions.hideDropMenu = function() {
  this.app.setState({
    dropMenu: false
  });
};

appActions.toggleDropMenu = function(e) {
  if (e) {
    e.stopPropagation();
  }
  var dropMenu = this.app.state.dropMenu;
  this.app.setState({
    dropMenu: !dropMenu
  });
};

appActions._logMetric = function(eventName, properties) {
  api.metrics.track(eventName, properties);
};

appActions._logError = function(error, friendlyMessage, properties) {
  api.errors.log(error, friendlyMessage, properties);
};

appActions._mergeDevicesWithUploads = function(devices, uploads) {
  var self = this;

  // map connected devices to upload ids
  var connectedDeviceMap = _.reduce(devices, function(acc, d) {
    var upload = self._newUploadFromDevice(d);
    acc[self._getUploadId(upload)] = d;
    return acc;
  }, {});

  // work only on device uploads
  var deviceUploads = _.filter(uploads, function(upload) {
    return upload.source.type === 'device';
  });

  // mark device uploads that are disconnected
  // and add any newly connected devices at the end of the list
  var newDeviceMap = _.clone(connectedDeviceMap);
  _.forEach(deviceUploads, function(upload) {
    var uploadId = self._getUploadId(upload);
    var connectedDevice = connectedDeviceMap[uploadId];
    if (!connectedDevice) {
      upload.source.connected = false;
      delete upload.progress;
    }
    else {
      upload.source = _.assign(
        upload.source, {connected: true}, connectedDevice
      );
      delete newDeviceMap[uploadId];
    }
  });
  _.forEach(_.values(newDeviceMap), function(d) {
    deviceUploads.push(self._newUploadFromDevice(d));
  });

  // add back CareLink upload at beginning of list
  var carelinkUpload = _.find(uploads, function(upload) {
    return upload.source.type === 'carelink';
  });
  var newUploads = deviceUploads;
  if (carelinkUpload) {
    newUploads.unshift(carelinkUpload);
  }

  return newUploads;
};

appActions._getUploadId = function(upload) {
  var source = upload.source;
  if (source.type === 'device' || source.type === 'block') {
    return source.driverId;
  }
  if (source.type === 'carelink') {
    return source.type;
  }
  return null;
};

appActions._newUploadFromDevice = function(d) {
  return {
    source: _.assign({type: 'device'}, d, {connected: true})
  };
};

appActions.readFile = function(uploadIndex, targetId, file, extension) {
  var self = this;

  if (!file) {
    return;
  }

  function inputError(error) {
    self._updateUpload(uploadIndex, function(upload) {
      var now = self._now();
      var instance = {
        targetId: targetId,
        start: now,
        step: 'start',
        percentage: 0,
        finish: now,
        error: error
      };
      upload.progress = instance;
      upload = self._addToUploadHistory(upload, instance);
      return upload;
    });
  }

  if (file.name.slice(-extension.length) === extension) {
    var reader = new FileReader();

    // display filename in UI before loading
    reader.onloadstart = function() {
        self._updateUpload(uploadIndex, function(upload) {
        upload.file = {
          name: file.name
        };
          return upload;
        });
    };

    reader.onerror = function() {
      var error = new Error(self.errorText.E_READING_FILE + file.name);
      appActions.addMoreInfoToError(error, appActions.errorStages['E_READING_FILE']);
      inputError(error);
      // the return is just for ease of testing
      return error;
    };

    reader.onloadend = (function(theFile) {
      return function(e) {
        self._updateUpload(uploadIndex, function(upload) {
          upload.file.data = e.srcElement.result;
          var options = {
            filename: upload.file.name,
            filedata: upload.file.data
          };
          self.upload(uploadIndex, options);
          return upload;
        });
      };
    })(file);

    reader.readAsArrayBuffer(file);

    return true;
  }
  else {
    var error = new Error(self.errorText.E_WRONG_FILE_EXT + extension);
    appActions.addMoreInfoToError(error, appActions.errorStages['STAGE_PICK_FILE']);
    inputError(error);
    // the return is just for ease of testing
    return error;
  }
};

appActions.upload = function(uploadIndex, options, cb) {
  var self = this;
  cb = cb || _.noop;

  this._assertValidUploadIndex(uploadIndex);

  if (appState.hasUploadInProgress()) {
    var err = new Error(self.errorText.E_UPLOAD_IN_PROGRESS);
    appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_UPLOAD']);
    throw err;
  }

  var upload = this.app.state.uploads[uploadIndex];

  options = _.assign(options, {
    targetId: this.app.state.targetId,
    timezone: this.app.state.targetTimezone,
    progress: this._setUploadPercentage.bind(this, uploadIndex),
    version: config.namedVersion //e.g. Tidepool Uploader v0.1.0
  });
  var onUploadFinish = function(err, records) {
    if (err) {
      self._handleUploadError(uploadIndex, err);
      return cb(err);
    }
    self._handleUploadSuccess(uploadIndex, records);
    return cb(null, records);
  };

  this._setUploadStart(uploadIndex, options);

  self._logMetric(
    self.trackedState.UPLOAD_STARTED+' '+self._getUploadId(upload),
    { type: upload.source.type, source:upload.source.driverId }
  );

  if (upload.source.type === 'device' || upload.source.type === 'block') {
    var driverId = this.app.state.uploads[uploadIndex].source.driverId;
    return this._uploadDevice(driverId, options, onUploadFinish);
  }
  else if (upload.source.type === 'carelink') {
    var credentials = {
      username: options.username,
      password: options.password
    };
    return this._uploadCarelink(credentials, options, onUploadFinish);
  }
  else {
    var error = new Error(self.errorText.E_UNSUPPORTED_TYPE + upload.source.type);
    appActions.addMoreInfoToError(error, appActions.errorStages['STAGE_UPLOAD']);
    throw error;
  }
};

appActions._assertValidUploadIndex = function(uploadIndex) {
  if (uploadIndex > this.app.state.uploads.length - 1) {
    var err = new Error(this.errorText.E_INVALID_UPLOAD_INDEX + uploadIndex);
    appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_UPLOAD']);
    throw err;
  }
};

appActions._setUploadStart = function(uploadIndex, options) {
  var self = this;
  this._updateUpload(uploadIndex, function(upload) {
    var progress = {
      targetId: options.targetId,
      start: self._now(),
      step: 'start',
      percentage: 0
    };

    // remember CareLink username we're uploading from
    if (options.username) {
      progress.username = options.username;
    }

    upload.progress = progress;
    return upload;
  });
};

appActions._setUploadPercentage = function(uploadIndex, step, percentage) {
  this._updateUpload(uploadIndex, function(upload) {
    upload.progress = _.assign(upload.progress, {
      step: step,
      percentage: percentage
    });
    return upload;
  });
};

appActions._handleUploadSuccess = function(uploadIndex, records) {
  var self = this;
  this._updateUpload(uploadIndex, function(upload) {
    //log metric details
    self._logMetric(
      self.trackedState.UPLOAD_SUCCESS+' '+self._getUploadId(upload),
      { type: upload.source.type,
        source: upload.source.driverId,
        started: upload.progress.start,
        finished: upload.progress.finish,
        processed: upload.progress.count
      }
    );

    var instance = _.assign(upload.progress, {
      finish: self._now(),
      success: true,
      count: records.length
    });
    upload.progress = instance;
    upload = self._addToUploadHistory(upload, instance);
    if (upload.file != null) {
      delete upload.file;
    }
    return upload;
  });
};

appActions._handleUploadError = function(uploadIndex, error) {
  var self = this;
  this._updateUpload(uploadIndex, function(upload) {

    // log the errors
    self._logMetric(
      self.trackedState.UPLOAD_FAILED +' '+self._getUploadId(upload),
      {type: upload.source.type ,source:upload.source.driverId, error: error }
    );

    self._logError(
      error,
      self.trackedState.UPLOAD_FAILED +' '+self._getUploadId(upload),
      {type: upload.source.type ,source:upload.source.driverId}
    );

    var instance = _.assign(upload.progress, {
      finish: self._now(),
      error: error
    });
    upload.progress = instance;
    upload = self._addToUploadHistory(upload, instance);
    if (upload.file != null) {
      delete upload.file;
    }
    return upload;
  });

  //for this specific error we are showing the page that prompts the user to update the uploader version
  if (error.code === 'outdatedVersion') {
    this.app.setState({ page: 'error' });
  }
};

appActions._addToUploadHistory = function(upload, instance) {
  var history = upload.history || [];
  history.unshift(instance);
  upload.history = history;
  return upload;
};

appActions._updateUpload = function(uploadIndex, updateFn) {
  var uploads = this.app.state.uploads;
  uploads[uploadIndex] = updateFn(uploads[uploadIndex]);
  this.app.setState({
    uploads: uploads
  });
};

appActions._uploadDevice = function(driverId, options, cb) {

  var self = this;

  device.detect(driverId, options, function(err, d) {
    if (err) {
      var currentOS = this.app.state._os; // "mac", "win", "android", "cros", "linux", or "openbsd"
      var upload = _.findWhere(this.app.state.uploads, {source : {driverId: driverId}});
      if(upload !== undefined) {
        if((currentOS === 'mac') && upload.mac) {
          appActions.errorStages['STAGE_DRIVER'].driverLink = upload.mac.driverLink;
          appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_DRIVER']);
          return cb(err);
        }else if((currentOS === 'win') && upload.win) {
          appActions.errorStages['STAGE_DRIVER'].driverLink = upload.win.driverLink;
          appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_DRIVER']);
          return cb(err);
        }
      }

      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_DEVICE_DETECT']);
      return cb(err);
    }

    if (!d && options.filename == null) {
      err = new Error(self.errorText.E_DEVICE_NOT_CONNECTED);
      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_DEVICE_DETECT']);
      return cb(err);
    }

    device.upload(driverId, options, function(err, records) {
      if (err) {
        appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_DEVICE_UPLOAD']);
        return cb(err);
      }

      records = records || [];
      return cb(null, records);
    });
  });
};

appActions._now = function() {
  return sundial.utcDateString();
};

appActions._uploadCarelink = function(credentials, options, cb) {
  var self = this;

  var payload = {
    targetUserId: options.targetId,
    carelinkUsername: credentials.username,
    carelinkPassword: credentials.password,
    daysAgo: config.DEFAULT_CARELINK_DAYS
  };

  api.upload.fetchCarelinkData(payload, function(err, data) {

    if (err) {
      appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_CARELINK_FETCH']);
      self._logMetric(self.trackedState.CARELINK_FETCH_FAILED);
      self._logError(err, self.trackedState.CARELINK_FETCH_FAILED);
      return cb(err);
    }

    self._logMetric(self.trackedState.CARELINK_FETCH_SUCCESS);

    carelink.upload(data, options, function(err, records) {
      if (err) {
        appActions.addMoreInfoToError(err, appActions.errorStages['STAGE_CARELINK_UPLOAD']);
        return cb(err);
      }

      records = records || [];
      return cb(null, records);
    });
  });
};

appActions.reset = function(uploadIndex) {
  this._assertValidUploadIndex(uploadIndex);
  this._updateUpload(uploadIndex, function(upload) {
    return _.omit(upload, 'progress');
  });
};

module.exports = appActions;
